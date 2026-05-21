#![no_std]
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, Vec,
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
    Rating(Address, BytesN<32>), // (vendor, tx_hash) → Rating
    RatingSum(Address),          // vendor → cumulative stars sum (u32)
    RatingCount(Address),        // vendor → total ratings (u32)
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
pub struct RatingSubmittedEvent {
    pub vendor: Address,
    pub customer: Address,
    pub stars: u32,
    pub tx_hash: BytesN<32>,
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

    pub fn increment_stats(env: Env, admin: Address, vendor: Address, amount: i128) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not admin");
        }
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

    // ── Internal ──────────────────────────────────────────────────────────────

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
