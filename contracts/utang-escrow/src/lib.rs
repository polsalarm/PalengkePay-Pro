#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, String, Vec,
};

const RESERVE_BPS: i128 = 100; // 1% of each installment skimmed to per-utang reserve
const LATE_FEE_BPS: i128 = 500; // 5% of installment_amount charged on resume_after_late
const DEFAULT_GRACE_SECONDS: u64 = 604_800; // 7 days past next_due before mark_default allowed
const DEFAULT_MAX_UTANG_AMOUNT: i128 = i128::MAX; // no cap by default; admin sets a real cap post-init

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum UtangStatus {
    Active,
    Completed,
    Defaulted,
}

#[contracttype]
#[derive(Clone)]
pub struct Utang {
    pub id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub total_amount: i128,
    pub installment_amount: i128,
    pub installments_total: u32,
    pub installments_paid: u32,
    pub next_due: u64,
    pub interval_seconds: u64,
    pub status: UtangStatus,
    pub description: String,
}

#[contracttype]
pub enum DataKey {
    Utang(u64),
    CustomerUtangs(Address),
    VendorUtangs(Address),
    UtangCount,
    Admin,
    Token,
    GracePeriod,
    CustomerDefaults(Address),
    VendorDefaults(Address),
    UtangReserve(u64),
    MaxUtangAmount,
    ActiveUtangCount,
}

#[contracttype]
pub struct UtangCreatedEvent {
    pub utang_id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub total_amount: i128,
    pub installments_total: u32,
}

#[contracttype]
pub struct InstallmentPaidEvent {
    pub utang_id: u64,
    pub installment_number: u32,
    pub amount: i128,
    pub remaining: u32,
}

#[contracttype]
pub struct UtangCompletedEvent {
    pub utang_id: u64,
    pub customer: Address,
    pub vendor: Address,
}

#[contracttype]
pub struct UtangDefaultedEvent {
    pub utang_id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub reserve_paid_out: i128,
}

#[contracttype]
pub struct UtangResumedEvent {
    pub utang_id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub late_fee: i128,
}

#[contracttype]
pub struct TokenChangedEvent {
    pub old_token: Address,
    pub new_token: Address,
}

#[contracttype]
pub struct MaxUtangAmountChangedEvent {
    pub old_max: i128,
    pub new_max: i128,
}

#[contracttype]
pub struct UpgradedEvent {
    pub new_wasm_hash: BytesN<32>,
}

#[contract]
pub struct UTangEscrow;

#[contractimpl]
impl UTangEscrow {
    pub fn initialize(env: Env, admin: Address, native_token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &native_token);
        env.storage().instance().set(&DataKey::UtangCount, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::GracePeriod, &DEFAULT_GRACE_SECONDS);
        env.storage()
            .instance()
            .set(&DataKey::MaxUtangAmount, &DEFAULT_MAX_UTANG_AMOUNT);
        env.storage()
            .instance()
            .set(&DataKey::ActiveUtangCount, &0u64);
    }

    /// Admin swaps the settlement token. BLOCKED while any utang is Active —
    /// otherwise in-flight utangs would have stranded reserve funds in the old token.
    /// Admin must coordinate: freeze new utang creation off-chain, let all active utangs
    /// complete or be defaulted, then call set_token.
    pub fn set_token(env: Env, admin: Address, new_token: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        let active: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveUtangCount)
            .unwrap_or(0);
        if active > 0 {
            panic!("cannot change token while active utangs exist");
        }
        let old_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        env.storage().instance().set(&DataKey::Token, &new_token);
        env.events().publish(
            (symbol_short!("utang"), symbol_short!("settoken")),
            TokenChangedEvent {
                old_token,
                new_token,
            },
        );
    }

    pub fn token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized")
    }

    /// Admin sets the cap on total_amount accepted by create_utang.
    /// Mainnet protection against runaway BNPL principal (e.g., cap at ₱5k worth of token stroops).
    pub fn set_max_utang_amount(env: Env, admin: Address, new_max: i128) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        if new_max <= 0 {
            panic!("max must be positive");
        }
        let old_max: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MaxUtangAmount)
            .unwrap_or(DEFAULT_MAX_UTANG_AMOUNT);
        env.storage()
            .instance()
            .set(&DataKey::MaxUtangAmount, &new_max);
        env.events().publish(
            (symbol_short!("utang"), symbol_short!("setmax")),
            MaxUtangAmountChangedEvent { old_max, new_max },
        );
    }

    pub fn max_utang_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MaxUtangAmount)
            .unwrap_or(DEFAULT_MAX_UTANG_AMOUNT)
    }

    pub fn active_utang_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ActiveUtangCount)
            .unwrap_or(0)
    }

    /// Admin swaps the contract's executable WASM. Preserves storage.
    /// Mainnet escape hatch for bug fixes — no redeploy = no new contract ID = no state migration.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());
        env.events().publish(
            (symbol_short!("utang"), symbol_short!("upgrade")),
            UpgradedEvent { new_wasm_hash },
        );
    }

    /// Admin can adjust grace period (seconds past next_due before default allowed).
    pub fn set_grace_period(env: Env, admin: Address, seconds: u64) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        env.storage()
            .instance()
            .set(&DataKey::GracePeriod, &seconds);
    }

    pub fn grace_period(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::GracePeriod)
            .unwrap_or(DEFAULT_GRACE_SECONDS)
    }

    /// Vendor creates utang agreement. First installment NOT collected here —
    /// customer pays each installment separately via pay_installment().
    pub fn create_utang(
        env: Env,
        vendor: Address,
        customer: Address,
        total_amount: i128,
        installments_total: u32,
        interval_seconds: u64,
        description: String,
    ) -> u64 {
        customer.require_auth();

        if total_amount <= 0 {
            panic!("total_amount must be positive");
        }
        if installments_total == 0 {
            panic!("installments_total must be at least 1");
        }
        if interval_seconds == 0 {
            panic!("interval_seconds must be positive");
        }
        let max_amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MaxUtangAmount)
            .unwrap_or(DEFAULT_MAX_UTANG_AMOUNT);
        if total_amount > max_amount {
            panic!("total_amount exceeds max_utang_amount");
        }

        // installment_amount = ceil(total / installments_total)
        let installment_amount =
            (total_amount + installments_total as i128 - 1) / installments_total as i128;

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::UtangCount)
            .unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::UtangCount, &count);

        let now = env.ledger().timestamp();
        let utang = Utang {
            id: count,
            customer: customer.clone(),
            vendor: vendor.clone(),
            total_amount,
            installment_amount,
            installments_total,
            installments_paid: 0,
            next_due: now + interval_seconds,
            interval_seconds,
            status: UtangStatus::Active,
            description,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Utang(count), &utang);
        env.storage()
            .persistent()
            .set(&DataKey::UtangReserve(count), &0i128);

        let active: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveUtangCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::ActiveUtangCount, &(active + 1));

        let mut customer_list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerUtangs(customer.clone()))
            .unwrap_or(Vec::new(&env));
        customer_list.push_back(count);
        env.storage()
            .persistent()
            .set(&DataKey::CustomerUtangs(customer.clone()), &customer_list);

        let mut vendor_list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorUtangs(vendor.clone()))
            .unwrap_or(Vec::new(&env));
        vendor_list.push_back(count);
        env.storage()
            .persistent()
            .set(&DataKey::VendorUtangs(vendor.clone()), &vendor_list);

        env.events().publish(
            (symbol_short!("utang"), symbol_short!("created")),
            UtangCreatedEvent {
                utang_id: count,
                customer,
                vendor,
                total_amount,
                installments_total,
            },
        );

        count
    }

    pub fn pay_installment(env: Env, customer: Address, utang_id: u64) {
        customer.require_auth();

        let mut utang: Utang = env
            .storage()
            .persistent()
            .get(&DataKey::Utang(utang_id))
            .expect("utang not found");

        if utang.customer != customer {
            panic!("not the debtor");
        }
        if utang.status != UtangStatus::Active {
            panic!("utang not active");
        }
        if utang.installments_paid >= utang.installments_total {
            panic!("already fully paid");
        }

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");

        let remaining_installments = utang.installments_total - utang.installments_paid;
        let remaining_amount =
            utang.total_amount - (utang.installment_amount * utang.installments_paid as i128);
        let pay_amount = if remaining_installments == 1 {
            remaining_amount
        } else {
            utang.installment_amount
        };

        let reserve_fee = (pay_amount * RESERVE_BPS) / 10_000;

        let token_client = token::Client::new(&env, &token_address);
        // Vendor gets the installment.
        token_client.transfer(&customer, &utang.vendor, &pay_amount);
        // Reserve fee held in contract custody until completion or default.
        if reserve_fee > 0 {
            token_client.transfer(&customer, &env.current_contract_address(), &reserve_fee);
            let prev: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::UtangReserve(utang_id))
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&DataKey::UtangReserve(utang_id), &(prev + reserve_fee));
        }

        utang.installments_paid += 1;
        let installment_number = utang.installments_paid;

        env.events().publish(
            (symbol_short!("utang"), symbol_short!("paid")),
            InstallmentPaidEvent {
                utang_id,
                installment_number,
                amount: pay_amount,
                remaining: utang.installments_total - utang.installments_paid,
            },
        );

        if utang.installments_paid >= utang.installments_total {
            utang.status = UtangStatus::Completed;
            // Completed cleanly — refund accumulated reserve back to customer.
            let reserve: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::UtangReserve(utang_id))
                .unwrap_or(0);
            if reserve > 0 {
                token_client.transfer(&env.current_contract_address(), &customer, &reserve);
                env.storage()
                    .persistent()
                    .set(&DataKey::UtangReserve(utang_id), &0i128);
            }
            let active: u64 = env
                .storage()
                .instance()
                .get(&DataKey::ActiveUtangCount)
                .unwrap_or(0);
            if active > 0 {
                env.storage()
                    .instance()
                    .set(&DataKey::ActiveUtangCount, &(active - 1));
            }
            env.events().publish(
                (symbol_short!("utang"), symbol_short!("done")),
                UtangCompletedEvent {
                    utang_id,
                    customer: utang.customer.clone(),
                    vendor: utang.vendor.clone(),
                },
            );
        } else {
            utang.next_due += utang.interval_seconds;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Utang(utang_id), &utang);
    }

    /// View: true if utang is Active and `now > next_due + grace_period`.
    pub fn is_overdue(env: Env, utang_id: u64) -> bool {
        let utang: Utang = match env.storage().persistent().get(&DataKey::Utang(utang_id)) {
            Some(u) => u,
            None => return false,
        };
        if utang.status != UtangStatus::Active {
            return false;
        }
        let grace: u64 = env
            .storage()
            .instance()
            .get(&DataKey::GracePeriod)
            .unwrap_or(DEFAULT_GRACE_SECONDS);
        env.ledger().timestamp() > utang.next_due + grace
    }

    /// Admin marks utang defaulted. Requires `now > next_due + grace_period`.
    /// Pays out accumulated reserve to vendor and increments customer/vendor default counters.
    pub fn mark_default(env: Env, admin: Address, utang_id: u64) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }

        let mut utang: Utang = env
            .storage()
            .persistent()
            .get(&DataKey::Utang(utang_id))
            .expect("utang not found");

        if utang.status != UtangStatus::Active {
            panic!("utang not active");
        }

        let grace: u64 = env
            .storage()
            .instance()
            .get(&DataKey::GracePeriod)
            .unwrap_or(DEFAULT_GRACE_SECONDS);
        if env.ledger().timestamp() <= utang.next_due + grace {
            panic!("grace period not elapsed");
        }

        // Pay out reserve to vendor as partial compensation.
        let reserve: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UtangReserve(utang_id))
            .unwrap_or(0);
        if reserve > 0 {
            let token_address: Address = env
                .storage()
                .instance()
                .get(&DataKey::Token)
                .expect("not initialized");
            token::Client::new(&env, &token_address).transfer(
                &env.current_contract_address(),
                &utang.vendor,
                &reserve,
            );
            env.storage()
                .persistent()
                .set(&DataKey::UtangReserve(utang_id), &0i128);
        }

        // Bump default counters.
        let cust_count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerDefaults(utang.customer.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(
            &DataKey::CustomerDefaults(utang.customer.clone()),
            &(cust_count + 1),
        );
        let vend_count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::VendorDefaults(utang.vendor.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(
            &DataKey::VendorDefaults(utang.vendor.clone()),
            &(vend_count + 1),
        );

        utang.status = UtangStatus::Defaulted;
        env.storage()
            .persistent()
            .set(&DataKey::Utang(utang_id), &utang);

        let active: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveUtangCount)
            .unwrap_or(0);
        if active > 0 {
            env.storage()
                .instance()
                .set(&DataKey::ActiveUtangCount, &(active - 1));
        }

        env.events().publish(
            (symbol_short!("utang"), symbol_short!("default")),
            UtangDefaultedEvent {
                utang_id,
                customer: utang.customer.clone(),
                vendor: utang.vendor.clone(),
                reserve_paid_out: reserve,
            },
        );
    }

    /// Customer pays late fee to resume a defaulted utang.
    /// Late fee = installment_amount * LATE_FEE_BPS / 10_000, paid direct to vendor.
    /// Status flips back to Active, next_due resets to now + interval.
    pub fn resume_after_late(env: Env, customer: Address, utang_id: u64) {
        customer.require_auth();

        let mut utang: Utang = env
            .storage()
            .persistent()
            .get(&DataKey::Utang(utang_id))
            .expect("utang not found");

        if utang.customer != customer {
            panic!("not the debtor");
        }
        if utang.status != UtangStatus::Defaulted {
            panic!("utang not defaulted");
        }

        let late_fee = (utang.installment_amount * LATE_FEE_BPS) / 10_000;
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        if late_fee > 0 {
            token::Client::new(&env, &token_address).transfer(&customer, &utang.vendor, &late_fee);
        }

        utang.status = UtangStatus::Active;
        utang.next_due = env.ledger().timestamp() + utang.interval_seconds;
        env.storage()
            .persistent()
            .set(&DataKey::Utang(utang_id), &utang);

        let active: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveUtangCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::ActiveUtangCount, &(active + 1));

        env.events().publish(
            (symbol_short!("utang"), symbol_short!("resumed")),
            UtangResumedEvent {
                utang_id,
                customer: utang.customer.clone(),
                vendor: utang.vendor.clone(),
                late_fee,
            },
        );
    }

    pub fn customer_defaults(env: Env, customer: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::CustomerDefaults(customer))
            .unwrap_or(0)
    }

    pub fn vendor_defaults(env: Env, vendor: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::VendorDefaults(vendor))
            .unwrap_or(0)
    }

    pub fn utang_reserve(env: Env, utang_id: u64) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::UtangReserve(utang_id))
            .unwrap_or(0)
    }

    pub fn get_utang(env: Env, utang_id: u64) -> Utang {
        env.storage()
            .persistent()
            .get(&DataKey::Utang(utang_id))
            .expect("utang not found")
    }

    pub fn get_customer_utangs(env: Env, customer: Address, limit: u32, offset: u32) -> Vec<Utang> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerUtangs(customer))
            .unwrap_or(Vec::new(&env));
        Self::fetch_page(&env, ids, limit, offset)
    }

    pub fn get_vendor_utangs(env: Env, vendor: Address, limit: u32, offset: u32) -> Vec<Utang> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorUtangs(vendor))
            .unwrap_or(Vec::new(&env));
        Self::fetch_page(&env, ids, limit, offset)
    }

    pub fn utang_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::UtangCount)
            .unwrap_or(0)
    }

    fn fetch_page(env: &Env, ids: Vec<u64>, limit: u32, offset: u32) -> Vec<Utang> {
        let mut result = Vec::new(env);
        let start = offset as usize;
        let end = (offset + limit) as usize;
        for i in start..end.min(ids.len() as usize) {
            if let Some(id) = ids.get(i as u32) {
                if let Some(u) = env.storage().persistent().get(&DataKey::Utang(id)) {
                    result.push_back(u);
                }
            }
        }
        result
    }
}

#[cfg(test)]
mod test;
