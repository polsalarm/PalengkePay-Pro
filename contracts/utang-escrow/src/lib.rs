#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, String, Vec,
};

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
        if total_amount <= 0 {
            panic!("total_amount must be positive");
        }
        if installments_total == 0 {
            panic!("installments_total must be at least 1");
        }
        if interval_seconds == 0 {
            panic!("interval_seconds must be positive");
        }

        // installment_amount = ceil(total / installments_total)
        let installment_amount = (total_amount + installments_total as i128 - 1)
            / installments_total as i128;

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
        env.storage().persistent().set(&DataKey::Utang(count), &utang);

        // Index by customer
        let mut customer_list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::CustomerUtangs(customer.clone()))
            .unwrap_or(Vec::new(&env));
        customer_list.push_back(count);
        env.storage()
            .persistent()
            .set(&DataKey::CustomerUtangs(customer.clone()), &customer_list);

        // Index by vendor
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

        // Last installment may be smaller if total doesn't divide evenly
        let remaining_installments = utang.installments_total - utang.installments_paid;
        let remaining_amount = utang.total_amount
            - (utang.installment_amount * utang.installments_paid as i128);
        let pay_amount = if remaining_installments == 1 {
            remaining_amount
        } else {
            utang.installment_amount
        };

        token::Client::new(&env, &token_address).transfer(
            &customer,
            &utang.vendor,
            &pay_amount,
        );

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

        env.storage().persistent().set(&DataKey::Utang(utang_id), &utang);
    }

    /// Admin can mark an overdue utang as defaulted.
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

        utang.status = UtangStatus::Defaulted;
        env.storage().persistent().set(&DataKey::Utang(utang_id), &utang);
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
        env.storage().instance().get(&DataKey::UtangCount).unwrap_or(0)
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
