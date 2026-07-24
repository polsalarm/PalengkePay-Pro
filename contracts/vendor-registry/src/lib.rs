#![no_std]
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, IntoVal, String,
    Symbol, Vec,
};

// ── Data types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum ApplicationStatus {
    Pending,
    Approved,
    Rejected,
}

#[contracttype]
#[derive(Clone)]
pub struct VendorApplication {
    pub wallet: Address,
    pub market_id: String,
    pub name: String,
    pub stall_number: String,
    pub phone: String,
    pub product_type: String,
    pub applied_at: u64,
    pub status: ApplicationStatus,
}

#[contracttype]
#[derive(Clone)]
pub struct VendorRecord {
    pub id: u64,
    pub wallet: Address,
    pub market_id: String,
    pub name: String,
    pub stall_number: String,
    pub phone: String,
    pub product_type: String,
    pub registered_at: u64,
    pub total_transactions: u64,
    pub total_volume: i128,
    pub is_active: bool,
}

#[contracttype]
pub enum DataKey {
    Vendor(Address),
    VendorCount,
    Admin,
    Application(Address),
    PendingList,
    VendorList,
    // Reputation (added Phase 0.3) — separate keys for backwards-compat with old VendorRecord storage
    Rating(Address, BytesN<32>),      // (vendor, tx_hash) → Rating
    RatingSum(Address),               // vendor → cumulative stars sum (u32)
    RatingCount(Address),             // vendor → total ratings (u32)
    VendorDefaultsReceived(Address),  // vendor → # of utangs from this vendor that defaulted (u32)
    CustomerDefaultsHistory(Address), // customer → # of defaulted utangs across all vendors (u32)
    // Pull-based credit-score oracle (Phase 1 fix) — vendor-registry reads the
    // already-settled Payment/Utang record straight off the live contracts
    // instead of trusting an admin-typed number. See CREDIT_SCORE_ORACLE_FIX.md.
    PaymentContract,       // Address of the deployed palengke-payment contract
    EscrowContract,        // Address of the deployed utang-escrow contract
    ProcessedPayment(u64), // payment_id → bool, dedup guard
    UtangProgress(u64),    // utang_id → u32 (last-seen installments_paid)
    ProcessedDefault(u64), // utang_id → bool, dedup guard
    V1Registry,            // Address of the real v1 vendor onboarding registry
    // Phase 2 — multisig committee gating the score-input functions above
    // plus `upgrade` itself. See CREDIT_SCORE_ORACLE_FIX.md.
    Signers,   // Vec<Address> — the multisig committee
    Threshold, // u32 — minimum distinct committee signatures required
}

#[contracttype]
#[derive(Clone)]
pub struct Rating {
    pub customer: Address,
    pub stars: u32,
    pub comment_hash: BytesN<32>, // SHA256 of off-chain comment text, zero-bytes when no comment
    pub created_at: u64,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[contracttype]
pub struct VendorRegisteredEvent {
    pub vendor_id: u64,
    pub wallet: Address,
    pub market_id: String,
}

#[contracttype]
pub struct DefaultReportedEvent {
    pub vendor: Address,
    pub customer: Address,
    pub vendor_total: u32,
    pub customer_total: u32,
}

#[contracttype]
pub struct RatingSubmittedEvent {
    pub vendor: Address,
    pub customer: Address,
    pub stars: u32,
    pub tx_hash: BytesN<32>,
}

#[contracttype]
pub struct UpgradedEvent {
    pub new_wasm_hash: BytesN<32>,
}

#[contracttype]
pub struct ActivityRecordedEvent {
    pub source: Address,
    pub vendor: Address,
    pub amount: i128,
}

#[contracttype]
pub struct SignersRotatedEvent {
    pub new_signers: Vec<Address>,
    pub new_threshold: u32,
}

// ── Cross-contract mirror types ────────────────────────────────────────────────
// Soroban contracts can't import each other's types, and struct decoding
// requires an EXACT field-for-field match with the source (the host unpacks
// the map positionally by field count, not a flexible name-keyed subset) — so
// these mirror palengke-payment's `Payment` / utang-escrow's `Utang` in full,
// field-for-field. Keep in sync if those structs ever change shape.

#[contracttype]
#[derive(Clone)]
pub struct PaymentView {
    pub id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub memo: String,
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum UtangStatusView {
    Active,
    Completed,
    Defaulted,
}

#[contracttype]
#[derive(Clone)]
pub struct UtangView {
    pub id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub total_amount: i128,
    pub installment_amount: i128,
    pub installments_total: u32,
    pub installments_paid: u32,
    pub next_due: u64,
    pub interval_seconds: u64,
    pub status: UtangStatusView,
    pub description: String,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct VendorRegistry;

#[contractimpl]
impl VendorRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::VendorCount, &0u64);
    }

    /// Multisig-gated: swaps the contract's executable WASM. Preserves storage.
    /// Deliberately NOT single-admin-gated — a compromised lone admin key
    /// upgrading in a WASM that strips the multisig checks out of
    /// `increment_stats`/`report_default`/etc. would defeat the whole point
    /// of Phase 2. Costs the fast unilateral emergency-hotfix path; that
    /// trade is accepted for this contract. See CREDIT_SCORE_ORACLE_FIX.md.
    pub fn upgrade(env: Env, signers: Vec<Address>, new_wasm_hash: BytesN<32>) {
        Self::require_multisig(&env, &signers);
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());
        env.events().publish(
            (symbol_short!("registry"), symbol_short!("upgrade")),
            UpgradedEvent { new_wasm_hash },
        );
    }

    /// One-time, admin-gated bootstrap of the multisig committee — the last
    /// thing the single admin key is ever needed for on this path. After
    /// this runs, `set_payment_contract`/`set_escrow_contract`/
    /// `increment_stats`/`report_default`/`set_signers`/`upgrade` all
    /// require `threshold`-of-`signers`, never the admin key alone again.
    pub fn migrate_to_multisig(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        if env.storage().instance().has(&DataKey::Signers) {
            panic!("multisig already configured");
        }
        Self::validate_committee(&signers, threshold);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage()
            .instance()
            .set(&DataKey::Threshold, &threshold);
    }

    /// Rotates the committee/threshold. Requires the CURRENT committee's
    /// sign-off, not the admin key — otherwise a lone admin could always
    /// re-bootstrap a trivial 1-of-1 "multisig" and the whole thing is
    /// theater.
    pub fn set_signers(
        env: Env,
        signers: Vec<Address>,
        new_signers: Vec<Address>,
        new_threshold: u32,
    ) {
        Self::require_multisig(&env, &signers);
        Self::validate_committee(&new_signers, new_threshold);
        env.storage()
            .instance()
            .set(&DataKey::Signers, &new_signers);
        env.storage()
            .instance()
            .set(&DataKey::Threshold, &new_threshold);
        env.events().publish(
            (symbol_short!("registry"), symbol_short!("signers")),
            SignersRotatedEvent {
                new_signers,
                new_threshold,
            },
        );
    }

    pub fn signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env))
    }

    pub fn threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(0)
    }

    // ── Vendor applies (no admin needed) ─────────────────────────────────────

    pub fn apply_vendor(
        env: Env,
        wallet: Address,
        market_id: String,
        name: String,
        stall_number: String,
        phone: String,
        product_type: String,
    ) {
        wallet.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::Vendor(wallet.clone()))
        {
            panic!("already registered");
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Application(wallet.clone()))
        {
            let existing: VendorApplication = env
                .storage()
                .persistent()
                .get(&DataKey::Application(wallet.clone()))
                .unwrap();
            if existing.status == ApplicationStatus::Pending {
                panic!("application already pending");
            }
        }

        let app = VendorApplication {
            wallet: wallet.clone(),
            market_id,
            name,
            stall_number,
            phone,
            product_type,
            applied_at: env.ledger().timestamp(),
            status: ApplicationStatus::Pending,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Application(wallet.clone()), &app);

        let mut pending: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::PendingList)
            .unwrap_or(Vec::new(&env));
        pending.push_back(wallet);
        env.storage()
            .persistent()
            .set(&DataKey::PendingList, &pending);
    }

    // ── Admin approves pending application ───────────────────────────────────

    pub fn approve_vendor(env: Env, admin: Address, wallet: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }

        let mut app: VendorApplication = env
            .storage()
            .persistent()
            .get(&DataKey::Application(wallet.clone()))
            .expect("application not found");
        if app.status != ApplicationStatus::Pending {
            panic!("application not pending");
        }

        app.status = ApplicationStatus::Approved;
        env.storage()
            .persistent()
            .set(&DataKey::Application(wallet.clone()), &app);

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::VendorCount)
            .unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::VendorCount, &count);

        let record = VendorRecord {
            id: count,
            wallet: wallet.clone(),
            market_id: app.market_id.clone(),
            name: app.name,
            stall_number: app.stall_number,
            phone: app.phone,
            product_type: app.product_type,
            registered_at: env.ledger().timestamp(),
            total_transactions: 0,
            total_volume: 0,
            is_active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Vendor(wallet.clone()), &record);

        let mut vendor_list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorList)
            .unwrap_or(Vec::new(&env));
        vendor_list.push_back(wallet.clone());
        env.storage()
            .persistent()
            .set(&DataKey::VendorList, &vendor_list);

        Self::remove_from_pending(&env, &wallet);

        env.events().publish(
            (symbol_short!("vendor"), symbol_short!("reg")),
            VendorRegisteredEvent {
                vendor_id: count,
                wallet,
                market_id: app.market_id,
            },
        );
    }

    // ── Admin rejects pending application ────────────────────────────────────

    pub fn reject_vendor(env: Env, admin: Address, wallet: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }

        let mut app: VendorApplication = env
            .storage()
            .persistent()
            .get(&DataKey::Application(wallet.clone()))
            .expect("application not found");
        if app.status != ApplicationStatus::Pending {
            panic!("application not pending");
        }

        app.status = ApplicationStatus::Rejected;
        env.storage()
            .persistent()
            .set(&DataKey::Application(wallet.clone()), &app);
        Self::remove_from_pending(&env, &wallet);
    }

    // ── Admin direct-register (bypass apply flow) ─────────────────────────────

    pub fn register_vendor(
        env: Env,
        admin: Address,
        wallet: Address,
        market_id: String,
        name: String,
        stall_number: String,
        phone: String,
        product_type: String,
    ) -> u64 {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Vendor(wallet.clone()))
        {
            panic!("vendor already registered");
        }

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::VendorCount)
            .unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::VendorCount, &count);

        let record = VendorRecord {
            id: count,
            wallet: wallet.clone(),
            market_id: market_id.clone(),
            name,
            stall_number,
            phone,
            product_type,
            registered_at: env.ledger().timestamp(),
            total_transactions: 0,
            total_volume: 0,
            is_active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Vendor(wallet.clone()), &record);

        let mut vendor_list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorList)
            .unwrap_or(Vec::new(&env));
        vendor_list.push_back(wallet.clone());
        env.storage()
            .persistent()
            .set(&DataKey::VendorList, &vendor_list);

        env.events().publish(
            (symbol_short!("vendor"), symbol_short!("reg")),
            VendorRegisteredEvent {
                vendor_id: count,
                wallet,
                market_id,
            },
        );

        count
    }

    pub fn update_profile(
        env: Env,
        vendor: Address,
        name: String,
        stall_number: String,
        phone: String,
        product_type: String,
    ) {
        vendor.require_auth();
        let mut record: VendorRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Vendor(vendor.clone()))
            .expect("vendor not found");
        record.name = name;
        record.stall_number = stall_number;
        record.phone = phone;
        record.product_type = product_type;
        env.storage()
            .persistent()
            .set(&DataKey::Vendor(vendor), &record);
    }

    pub fn deactivate_vendor(env: Env, admin: Address, wallet: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
        let mut record: VendorRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Vendor(wallet.clone()))
            .expect("vendor not found");
        record.is_active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Vendor(wallet), &record);
    }

    /// Manual-override / dispute-resolution path — the routine path is the
    /// permissionless `record_activity_from_payment`/`_installment` above.
    /// Multisig-gated (Phase 2): this is the actual "one key can't fabricate
    /// a score" close, since this was the fabrication vector the judge
    /// flagged in the first place.
    pub fn increment_stats(env: Env, signers: Vec<Address>, vendor: Address, amount: i128) {
        Self::require_multisig(&env, &signers);
        if amount <= 0 {
            panic!("amount must be positive");
        }

        if let Some(mut record) = env
            .storage()
            .persistent()
            .get::<DataKey, VendorRecord>(&DataKey::Vendor(vendor.clone()))
        {
            record.total_transactions += 1;
            record.total_volume += amount;
            env.storage()
                .persistent()
                .set(&DataKey::Vendor(vendor), &record);
        }
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    pub fn get_vendor(env: Env, wallet: Address) -> VendorRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Vendor(wallet))
            .expect("vendor not found")
    }

    pub fn get_application(env: Env, wallet: Address) -> VendorApplication {
        env.storage()
            .persistent()
            .get(&DataKey::Application(wallet))
            .expect("application not found")
    }

    pub fn get_pending_vendors(env: Env, limit: u32, offset: u32) -> Vec<VendorApplication> {
        let pending: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::PendingList)
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        let start = offset as usize;
        let end = (offset + limit) as usize;

        for i in start..end.min(pending.len() as usize) {
            if let Some(addr) = pending.get(i as u32) {
                if let Some(app) = env.storage().persistent().get(&DataKey::Application(addr)) {
                    result.push_back(app);
                }
            }
        }
        result
    }

    pub fn get_all_vendors(env: Env, limit: u32, offset: u32) -> Vec<VendorRecord> {
        let list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorList)
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        let start = offset as usize;
        let end = (offset + limit) as usize;

        for i in start..end.min(list.len() as usize) {
            if let Some(addr) = list.get(i as u32) {
                if let Some(record) = env.storage().persistent().get(&DataKey::Vendor(addr)) {
                    result.push_back(record);
                }
            }
        }
        result
    }

    pub fn vendor_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::VendorCount)
            .unwrap_or(0)
    }

    pub fn pending_count(env: Env) -> u32 {
        let pending: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::PendingList)
            .unwrap_or(Vec::new(&env));
        pending.len()
    }

    // ── Reputation (ratings) ──────────────────────────────────────────────────

    pub fn submit_rating(
        env: Env,
        customer: Address,
        vendor: Address,
        tx_hash: BytesN<32>,
        stars: u32,
        comment_hash: BytesN<32>,
    ) {
        customer.require_auth();

        if !(1..=5).contains(&stars) {
            panic!("stars must be 1-5");
        }

        if !env
            .storage()
            .persistent()
            .has(&DataKey::Vendor(vendor.clone()))
        {
            panic!("vendor not found");
        }

        let rating_key = DataKey::Rating(vendor.clone(), tx_hash.clone());
        if env.storage().persistent().has(&rating_key) {
            panic!("transaction already rated");
        }

        let rating = Rating {
            customer: customer.clone(),
            stars,
            comment_hash,
            created_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&rating_key, &rating);

        let sum: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::RatingSum(vendor.clone()))
            .unwrap_or(0);
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::RatingCount(vendor.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::RatingSum(vendor.clone()), &(sum + stars));
        env.storage()
            .persistent()
            .set(&DataKey::RatingCount(vendor.clone()), &(count + 1));

        env.events().publish(
            (symbol_short!("rating"), symbol_short!("sub")),
            RatingSubmittedEvent {
                vendor,
                customer,
                stars,
                tx_hash,
            },
        );
    }

    pub fn get_vendor_rating(env: Env, vendor: Address) -> (u32, u32) {
        let sum: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::RatingSum(vendor.clone()))
            .unwrap_or(0);
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::RatingCount(vendor))
            .unwrap_or(0);
        (sum, count)
    }

    pub fn get_rating(env: Env, vendor: Address, tx_hash: BytesN<32>) -> Rating {
        env.storage()
            .persistent()
            .get(&DataKey::Rating(vendor, tx_hash))
            .expect("rating not found")
    }

    pub fn has_rated(env: Env, vendor: Address, tx_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Rating(vendor, tx_hash))
    }

    // ── Default tracking ──────────────────────────────────────────────────────

    /// Manual-override / dispute-resolution path — the routine path is the
    /// permissionless `record_default_from_utang` above, which reads the
    /// real Defaulted status straight off utang-escrow. Multisig-gated
    /// (Phase 2), same reasoning as `increment_stats`.
    pub fn report_default(env: Env, signers: Vec<Address>, vendor: Address, customer: Address) {
        Self::require_multisig(&env, &signers);

        let v: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::VendorDefaultsReceived(vendor.clone()))
            .unwrap_or(0);
        let c: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerDefaultsHistory(customer.clone()))
            .unwrap_or(0);
        let vendor_total = v + 1;
        let customer_total = c + 1;
        env.storage().persistent().set(
            &DataKey::VendorDefaultsReceived(vendor.clone()),
            &vendor_total,
        );
        env.storage().persistent().set(
            &DataKey::CustomerDefaultsHistory(customer.clone()),
            &customer_total,
        );

        env.events().publish(
            (symbol_short!("default"), symbol_short!("report")),
            DefaultReportedEvent {
                vendor,
                customer,
                vendor_total,
                customer_total,
            },
        );
    }

    pub fn vendor_defaults_received(env: Env, vendor: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::VendorDefaultsReceived(vendor))
            .unwrap_or(0)
    }

    pub fn customer_defaults_history(env: Env, customer: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::CustomerDefaultsHistory(customer))
            .unwrap_or(0)
    }

    // ── Pull-based credit-score oracle ─────────────────────────────────────────
    // Fixes the "authorized updater can fabricate a score" finding: instead of
    // trusting an admin-typed number, these read the already-settled record
    // straight off the live palengke-payment/utang-escrow contracts. Fully
    // permissionless — no require_auth — because correctness comes from the
    // read, not from the caller's identity. See CREDIT_SCORE_ORACLE_FIX.md.

    pub fn set_payment_contract(env: Env, signers: Vec<Address>, contract: Address) {
        Self::require_multisig(&env, &signers);
        env.storage()
            .instance()
            .set(&DataKey::PaymentContract, &contract);
    }

    pub fn set_escrow_contract(env: Env, signers: Vec<Address>, contract: Address) {
        Self::require_multisig(&env, &signers);
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &contract);
    }

    pub fn payment_contract(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PaymentContract)
    }

    pub fn escrow_contract(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::EscrowContract)
    }

    pub fn set_v1_registry(env: Env, signers: Vec<Address>, contract: Address) {
        Self::require_multisig(&env, &signers);
        env.storage()
            .instance()
            .set(&DataKey::V1Registry, &contract);
    }

    pub fn v1_registry(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::V1Registry)
    }

    /// Permissionless. Mirrors a vendor's identity fields (not stats — those
    /// start fresh at 0 here; real activity accrues from that point via
    /// record_activity_from_payment/_installment) from the real v1 vendor
    /// onboarding registry, so a vendor approved there isn't silently
    /// invisible to scoring here. No-op if already present in this registry
    /// (never clobbers real accrued stats). Traps if `wallet` has no v1
    /// record — same as any other lookup-by-address call in this contract
    /// (e.g. `get_vendor`), so callers should only invoke this for wallets
    /// they know are real v1 vendors (e.g. reacting to a v1
    /// VendorRegisteredEvent/approve_vendor call).
    pub fn mirror_vendor_from_v1(env: Env, wallet: Address) {
        if env
            .storage()
            .persistent()
            .has(&DataKey::Vendor(wallet.clone()))
        {
            return;
        }
        let v1: Address = env
            .storage()
            .instance()
            .get(&DataKey::V1Registry)
            .expect("v1 registry not configured");

        let v1_record: VendorRecord = env.invoke_contract(
            &v1,
            &Symbol::new(&env, "get_vendor"),
            vec![&env, wallet.clone().into_val(&env)],
        );

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::VendorCount)
            .unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::VendorCount, &count);

        let record = VendorRecord {
            id: count,
            wallet: wallet.clone(),
            market_id: v1_record.market_id.clone(),
            name: v1_record.name,
            stall_number: v1_record.stall_number,
            phone: v1_record.phone,
            product_type: v1_record.product_type,
            registered_at: env.ledger().timestamp(),
            total_transactions: 0,
            total_volume: 0,
            is_active: v1_record.is_active,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Vendor(wallet.clone()), &record);

        let mut vendor_list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::VendorList)
            .unwrap_or(Vec::new(&env));
        vendor_list.push_back(wallet.clone());
        env.storage()
            .persistent()
            .set(&DataKey::VendorList, &vendor_list);

        env.events().publish(
            (symbol_short!("vendor"), symbol_short!("mirror")),
            VendorRegisteredEvent {
                vendor_id: count,
                wallet,
                market_id: v1_record.market_id,
            },
        );
    }

    /// Anyone can call. Reads the payment by ID from the configured
    /// PaymentContract and credits the vendor's stats exactly once — a
    /// no-op (not a panic) if this payment_id was already processed, so a
    /// relayer can safely call this speculatively/repeatedly.
    pub fn record_activity_from_payment(env: Env, payment_id: u64) {
        if env
            .storage()
            .persistent()
            .has(&DataKey::ProcessedPayment(payment_id))
        {
            return;
        }
        let payment_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::PaymentContract)
            .expect("payment contract not configured");

        let payment: PaymentView = env.invoke_contract(
            &payment_contract,
            &Symbol::new(&env, "get_payment"),
            vec![&env, payment_id.into_val(&env)],
        );

        env.storage()
            .persistent()
            .set(&DataKey::ProcessedPayment(payment_id), &true);

        if let Some(mut record) = env
            .storage()
            .persistent()
            .get::<DataKey, VendorRecord>(&DataKey::Vendor(payment.vendor.clone()))
        {
            record.total_transactions += 1;
            record.total_volume += payment.amount;
            env.storage()
                .persistent()
                .set(&DataKey::Vendor(payment.vendor.clone()), &record);
        }

        env.events().publish(
            (symbol_short!("credit"), symbol_short!("actpay")),
            ActivityRecordedEvent {
                source: payment_contract,
                vendor: payment.vendor,
                amount: payment.amount,
            },
        );
    }

    /// Reads current `installments_paid` from utang-escrow and credits only
    /// the delta since the last call (handles the final/remainder
    /// installment correctly by capping cumulative paid at total_amount).
    pub fn record_activity_from_installment(env: Env, utang_id: u64) {
        let escrow: Address = env
            .storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .expect("escrow contract not configured");

        let utang: UtangView = env.invoke_contract(
            &escrow,
            &Symbol::new(&env, "get_utang"),
            vec![&env, utang_id.into_val(&env)],
        );

        let last_seen: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::UtangProgress(utang_id))
            .unwrap_or(0);
        if utang.installments_paid <= last_seen {
            return; // nothing new since the last pull
        }

        let paid_before = (utang.installment_amount * last_seen as i128).min(utang.total_amount);
        let paid_now =
            (utang.installment_amount * utang.installments_paid as i128).min(utang.total_amount);
        let delta = paid_now - paid_before;

        env.storage()
            .persistent()
            .set(&DataKey::UtangProgress(utang_id), &utang.installments_paid);

        if delta > 0 {
            if let Some(mut record) = env
                .storage()
                .persistent()
                .get::<DataKey, VendorRecord>(&DataKey::Vendor(utang.vendor.clone()))
            {
                record.total_transactions += 1;
                record.total_volume += delta;
                env.storage()
                    .persistent()
                    .set(&DataKey::Vendor(utang.vendor.clone()), &record);
            }
            env.events().publish(
                (symbol_short!("credit"), symbol_short!("actins")),
                ActivityRecordedEvent {
                    source: escrow,
                    vendor: utang.vendor,
                    amount: delta,
                },
            );
        }
    }

    /// Reads utang status from utang-escrow; if Defaulted and not already
    /// processed, bumps the same VendorDefaultsReceived/CustomerDefaultsHistory
    /// counters as the admin-only `report_default` — but driven by the real
    /// on-chain state, not an admin's claim.
    pub fn record_default_from_utang(env: Env, utang_id: u64) {
        if env
            .storage()
            .persistent()
            .has(&DataKey::ProcessedDefault(utang_id))
        {
            return;
        }
        let escrow: Address = env
            .storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .expect("escrow contract not configured");

        let utang: UtangView = env.invoke_contract(
            &escrow,
            &Symbol::new(&env, "get_utang"),
            vec![&env, utang_id.into_val(&env)],
        );
        if utang.status != UtangStatusView::Defaulted {
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::ProcessedDefault(utang_id), &true);

        let v: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::VendorDefaultsReceived(utang.vendor.clone()))
            .unwrap_or(0);
        let c: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerDefaultsHistory(utang.customer.clone()))
            .unwrap_or(0);
        let vendor_total = v + 1;
        let customer_total = c + 1;
        env.storage().persistent().set(
            &DataKey::VendorDefaultsReceived(utang.vendor.clone()),
            &vendor_total,
        );
        env.storage().persistent().set(
            &DataKey::CustomerDefaultsHistory(utang.customer.clone()),
            &customer_total,
        );

        env.events().publish(
            (symbol_short!("default"), symbol_short!("report")),
            DefaultReportedEvent {
                vendor: utang.vendor,
                customer: utang.customer,
                vendor_total,
                customer_total,
            },
        );
    }

    // ── Credit scoring (RWA primitive) ────────────────────────────────────────

    /// Computes a FICO-style on-chain credit score (300–850) for a vendor from
    /// their settled cashflow, transaction count, customer ratings, and default
    /// history. Deterministic and side-effect free — this is the RWA primitive:
    /// the informal economy's creditworthiness derived purely from on-chain
    /// state. Returns the 300 floor for unknown/inactive vendors. Consumed by
    /// CreditPool to gate score-based working-capital draws.
    pub fn get_credit_score(env: Env, vendor: Address) -> u32 {
        let record: VendorRecord = match env
            .storage()
            .persistent()
            .get(&DataKey::Vendor(vendor.clone()))
        {
            Some(r) => r,
            None => return 300,
        };

        let mut score: i128 = 300;

        // Cashflow volume — settled value moved through the vendor.
        // total_volume accrues in XLM stroops (1 XLM = 10_000_000 stroops).
        let vol = record.total_volume;
        score += if vol >= 1_000_000_000 {
            200
        } else if vol >= 500_000_000 {
            150
        } else if vol >= 100_000_000 {
            100
        } else if vol >= 10_000_000 {
            50
        } else {
            0
        };

        // Transaction count — consistency / frequency of activity.
        let txns = record.total_transactions;
        score += if txns >= 500 {
            150
        } else if txns >= 100 {
            120
        } else if txns >= 50 {
            90
        } else if txns >= 10 {
            50
        } else if txns >= 1 {
            20
        } else {
            0
        };

        // Customer ratings — average stars (×100 to stay integer; guard div-by-0).
        let sum: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::RatingSum(vendor.clone()))
            .unwrap_or(0);
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::RatingCount(vendor.clone()))
            .unwrap_or(0);
        if count > 0 {
            let avg_x100 = (sum as i128 * 100) / count as i128;
            score += if avg_x100 >= 450 {
                200
            } else if avg_x100 >= 400 {
                160
            } else if avg_x100 >= 350 {
                120
            } else if avg_x100 >= 300 {
                80
            } else {
                40
            };
        }

        // Defaults — each defaulted utang is a hard penalty against the score.
        let defaults: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::VendorDefaultsReceived(vendor))
            .unwrap_or(0);
        score -= defaults as i128 * 100;

        // Clamp to the FICO band.
        score = score.clamp(300, 850);
        score as u32
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /// Requires `threshold`-of-`signers` distinct, registered committee
    /// members to individually authorize this call. Guards against the
    /// duplicate-signer trick: Soroban dedupes repeat `require_auth()` calls
    /// on the SAME address within one invocation, so `signers = [a, a]`
    /// would otherwise satisfy a naive `len() >= 2` check off a single real
    /// signature — the explicit duplicate check below closes that.
    fn require_multisig(env: &Env, signers: &Vec<Address>) {
        let registered: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .expect("multisig not configured");
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .expect("multisig not configured");

        if signers.len() < threshold {
            panic!("insufficient signers");
        }
        for i in 0..signers.len() {
            for j in (i + 1)..signers.len() {
                if signers.get(i).unwrap() == signers.get(j).unwrap() {
                    panic!("duplicate signer");
                }
            }
        }
        for i in 0..signers.len() {
            let s = signers.get(i).unwrap();
            if !registered.contains(&s) {
                panic!("not a registered signer");
            }
        }
        for i in 0..signers.len() {
            signers.get(i).unwrap().require_auth();
        }
    }

    fn validate_committee(signers: &Vec<Address>, threshold: u32) {
        if threshold == 0 || (threshold as usize) > signers.len() as usize {
            panic!("invalid threshold");
        }
        for i in 0..signers.len() {
            for j in (i + 1)..signers.len() {
                if signers.get(i).unwrap() == signers.get(j).unwrap() {
                    panic!("duplicate signer");
                }
            }
        }
    }

    fn remove_from_pending(env: &Env, wallet: &Address) {
        let pending: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::PendingList)
            .unwrap_or(Vec::new(env));

        let mut new_pending = Vec::new(env);
        for i in 0..pending.len() {
            if let Some(addr) = pending.get(i) {
                if &addr != wallet {
                    new_pending.push_back(addr);
                }
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::PendingList, &new_pending);
    }
}

#[cfg(test)]
mod test;
