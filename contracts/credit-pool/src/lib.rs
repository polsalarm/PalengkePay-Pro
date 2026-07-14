#![no_std]
//! CreditPool — score-gated working-capital lending for palengke vendors.
//!
//! This is the composability layer over the credit RWA: a USDC liquidity pool
//! that lends working capital to vendors, with each vendor's draw limit gated by
//! their on-chain credit score (`VendorRegistry::get_credit_score`). The
//! informal economy's manufactured credit history becomes underwritable here —
//! permissionless, no loan shark.
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, vec, Address, Env, IntoVal, Symbol,
};

/// USDC (7-decimal) of credit line granted per credit-score point above the
/// minimum. Score 850 with a 500 floor ⇒ 350 points ⇒ 350 USDC ceiling.
const CREDIT_PER_POINT: i128 = 10_000_000;
/// Below this score a vendor has no working-capital line (loan-shark territory).
const DEFAULT_MIN_SCORE: u32 = 500;

#[contracttype]
pub enum DataKey {
    Admin,
    Token,             // USDC SAC address (settlement asset)
    Registry,          // VendorRegistry address (credit oracle)
    MinScore,          // u32 — minimum score to qualify for a line
    Debt(Address),     // vendor → outstanding principal owed
    Schedule(Address), // vendor → auto-repay cadence config
}

/// Vendor-configured auto-repay cadence. Actual fund movement on `collect`
/// relies on a standing `token.approve(vendor, pool, cap, expiration_ledger)`
/// set up separately by the vendor — this struct only tracks *when* and
/// *how much*, never custodies an allowance itself.
#[contracttype]
pub struct ScheduleConfig {
    pub interval_seconds: u64,
    pub amount_per_period: i128,
    pub next_due: u64,
}

#[contracttype]
pub struct PoolFundedEvent {
    pub from: Address,
    pub amount: i128,
    pub balance: i128,
}

#[contracttype]
pub struct DrawEvent {
    pub vendor: Address,
    pub amount: i128,
    pub score: u32,
    pub new_debt: i128,
}

#[contracttype]
pub struct RepayEvent {
    pub vendor: Address,
    pub amount: i128,
    pub new_debt: i128,
}

#[contracttype]
pub struct CollectEvent {
    pub vendor: Address,
    pub amount: i128,
    pub new_debt: i128,
    pub next_due: u64,
}

#[contract]
pub struct CreditPool;

#[contractimpl]
impl CreditPool {
    pub fn initialize(env: Env, admin: Address, token: Address, registry: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage()
            .instance()
            .set(&DataKey::MinScore, &DEFAULT_MIN_SCORE);
    }

    /// LP funds the pool with USDC. Liquidity is custodied by the contract and
    /// lent out to score-qualified vendors.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let token_addr = Self::token(env.clone());
        token::Client::new(&env, &token_addr).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        let balance = Self::pool_balance(env.clone());
        env.events().publish(
            (symbol_short!("pool"), symbol_short!("fund")),
            PoolFundedEvent {
                from,
                amount,
                balance,
            },
        );
    }

    /// Vendor draws working capital. Gated by `available_to` — the lesser of the
    /// vendor's remaining credit headroom and the pool's free liquidity.
    pub fn draw(env: Env, vendor: Address, amount: i128) {
        vendor.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let available = Self::available_to(env.clone(), vendor.clone());
        if amount > available {
            panic!("exceeds available credit");
        }

        let token_addr = Self::token(env.clone());
        token::Client::new(&env, &token_addr).transfer(
            &env.current_contract_address(),
            &vendor,
            &amount,
        );

        let new_debt = Self::debt(env.clone(), vendor.clone()) + amount;
        env.storage()
            .persistent()
            .set(&DataKey::Debt(vendor.clone()), &new_debt);

        let score = Self::read_score(&env, &vendor);
        env.events().publish(
            (symbol_short!("credit"), symbol_short!("draw")),
            DrawEvent {
                vendor,
                amount,
                score,
                new_debt,
            },
        );
    }

    /// Vendor repays principal. Overpayment is clamped to the outstanding debt,
    /// so only what is owed is pulled.
    pub fn repay(env: Env, vendor: Address, amount: i128) {
        vendor.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let debt = Self::debt(env.clone(), vendor.clone());
        if debt == 0 {
            panic!("no outstanding debt");
        }
        let pay = if amount < debt { amount } else { debt };

        let token_addr = Self::token(env.clone());
        token::Client::new(&env, &token_addr).transfer(
            &vendor,
            &env.current_contract_address(),
            &pay,
        );

        let new_debt = debt - pay;
        env.storage()
            .persistent()
            .set(&DataKey::Debt(vendor.clone()), &new_debt);

        env.events().publish(
            (symbol_short!("credit"), symbol_short!("repay")),
            RepayEvent {
                vendor,
                amount: pay,
                new_debt,
            },
        );
    }

    /// Vendor opts in to scheduled auto-repay. Requires a matching
    /// `token.approve(vendor, pool, cap, expiration_ledger)` set up
    /// separately (frontend calls the token contract directly) — this call
    /// only sets cadence/amount, it never touches the allowance.
    pub fn set_schedule(env: Env, vendor: Address, interval_seconds: u64, amount_per_period: i128) {
        vendor.require_auth();
        if interval_seconds == 0 || amount_per_period <= 0 {
            panic!("invalid schedule");
        }
        env.storage().persistent().set(
            &DataKey::Schedule(vendor.clone()),
            &ScheduleConfig {
                interval_seconds,
                amount_per_period,
                next_due: env.ledger().timestamp() + interval_seconds,
            },
        );
    }

    /// Vendor cancels auto-repay. Does NOT revoke the token allowance —
    /// vendor should also `token.approve(vendor, pool, 0, ledger)` to kill
    /// the pull right entirely (works even if this app is unreachable).
    pub fn cancel_schedule(env: Env, vendor: Address) {
        vendor.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Schedule(vendor));
    }

    /// Permissionless — anyone (our cron relayer) can trigger this. No vendor
    /// auth is required: funds only move up to what the vendor already
    /// approved on the token contract, and the on-chain cadence gate below
    /// stops it being called early to drain the whole allowance at once.
    pub fn collect(env: Env, vendor: Address) {
        let key = DataKey::Schedule(vendor.clone());
        let mut sched: ScheduleConfig = env
            .storage()
            .persistent()
            .get(&key)
            .expect("no schedule set");

        if env.ledger().timestamp() < sched.next_due {
            panic!("not due yet");
        }

        let debt = Self::debt(env.clone(), vendor.clone());
        if debt == 0 {
            panic!("no outstanding debt");
        }
        let amount = if sched.amount_per_period < debt {
            sched.amount_per_period
        } else {
            debt
        };

        let token_addr = Self::token(env.clone());
        let pool_addr = env.current_contract_address();
        // Spender == this contract's own address, so this call self-authorizes
        // without needing vendor's signature — only the vendor's standing
        // token allowance gates how much can actually move.
        token::Client::new(&env, &token_addr)
            .transfer_from(&pool_addr, &vendor, &pool_addr, &amount);

        let new_debt = debt - amount;
        env.storage()
            .persistent()
            .set(&DataKey::Debt(vendor.clone()), &new_debt);

        sched.next_due += sched.interval_seconds;
        env.storage().persistent().set(&key, &sched);

        env.events().publish(
            (symbol_short!("credit"), symbol_short!("collect")),
            CollectEvent {
                vendor,
                amount,
                new_debt,
                next_due: sched.next_due,
            },
        );
    }

    // ── Views ──────────────────────────────────────────────────────────────

    /// Total credit line a vendor qualifies for, from their on-chain score.
    /// 0 when below the minimum score.
    pub fn credit_limit(env: Env, vendor: Address) -> i128 {
        let score = Self::read_score(&env, &vendor);
        let min: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MinScore)
            .unwrap_or(DEFAULT_MIN_SCORE);
        if score <= min {
            return 0;
        }
        (score - min) as i128 * CREDIT_PER_POINT
    }

    /// What the vendor can actually draw right now: remaining credit headroom,
    /// capped by available pool liquidity.
    pub fn available_to(env: Env, vendor: Address) -> i128 {
        let limit = Self::credit_limit(env.clone(), vendor.clone());
        let debt = Self::debt(env.clone(), vendor.clone());
        let headroom = if limit > debt { limit - debt } else { 0 };
        let liquidity = Self::pool_balance(env.clone());
        if headroom < liquidity {
            headroom
        } else {
            liquidity
        }
    }

    pub fn debt(env: Env, vendor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Debt(vendor))
            .unwrap_or(0)
    }

    pub fn schedule(env: Env, vendor: Address) -> Option<ScheduleConfig> {
        env.storage().persistent().get(&DataKey::Schedule(vendor))
    }

    pub fn pool_balance(env: Env) -> i128 {
        let token_addr = Self::token(env.clone());
        token::Client::new(&env, &token_addr).balance(&env.current_contract_address())
    }

    pub fn token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized")
    }

    pub fn registry(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Registry)
            .expect("not initialized")
    }

    pub fn min_score(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MinScore)
            .unwrap_or(DEFAULT_MIN_SCORE)
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    pub fn set_min_score(env: Env, admin: Address, new_min: u32) {
        admin.require_auth();
        let stored: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored {
            panic!("not admin");
        }
        env.storage().instance().set(&DataKey::MinScore, &new_min);
    }

    // ── Internal ───────────────────────────────────────────────────────────

    /// Cross-contract read of the vendor's credit score from VendorRegistry.
    fn read_score(env: &Env, vendor: &Address) -> u32 {
        let registry: Address = env
            .storage()
            .instance()
            .get(&DataKey::Registry)
            .expect("not initialized");
        env.invoke_contract(
            &registry,
            &Symbol::new(env, "get_credit_score"),
            vec![env, vendor.into_val(env)],
        )
    }
}

mod test;
