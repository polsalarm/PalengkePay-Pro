#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

const DAY: u64 = 86_400;
const WEEK: u64 = 604_800;

fn setup() -> (Env, UTangEscrowClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = asset.address();

    let contract_id = env.register(UTangEscrow, ());
    let client = UTangEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin, &token_address);

    (env, client, token_address)
}

fn setup_without_global_auth() -> (Env, UTangEscrowClient<'static>, Address) {
    let env = Env::default();

    let token_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = asset.address();

    let contract_id = env.register(UTangEscrow, ());
    let client = UTangEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.mock_all_auths().initialize(&admin, &token_address);

    (env, client, token_address)
}

fn mint_to(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

fn desc(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn advance_time(env: &Env, seconds: u64) {
    env.ledger().with_mut(|li| {
        li.timestamp += seconds;
    });
}

#[test]
fn test_utang_count_starts_zero() {
    let (env, _, token_address) = setup();
    let contract_id = env.register(UTangEscrow, ());
    let client2 = UTangEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client2.initialize(&admin, &token_address);
    assert_eq!(client2.utang_count(), 0);
}

#[test]
fn test_create_utang() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &(300_000_000i128),
        &3u32,
        &WEEK,
        &desc(&env, "3 kilo tilapia"),
    );
    assert_eq!(utang_id, 1);
    assert_eq!(client.utang_count(), 1);

    let utang = client.get_utang(&utang_id);
    assert_eq!(utang.customer, customer);
    assert_eq!(utang.vendor, vendor);
    assert_eq!(utang.total_amount, 300_000_000);
    assert_eq!(utang.installments_total, 3);
    assert_eq!(utang.installments_paid, 0);
    assert_eq!(utang.installment_amount, 100_000_000);
    assert_eq!(utang.status, UtangStatus::Active);
    assert_eq!(utang.description, desc(&env, "3 kilo tilapia"));
}

#[test]
#[should_panic]
fn test_create_utang_requires_customer_auth() {
    let (env, client, _) = setup_without_global_auth();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    client.create_utang(
        &vendor,
        &customer,
        &(300_000_000i128),
        &3u32,
        &WEEK,
        &desc(&env, "3 kilo tilapia"),
    );
}

#[test]
fn test_pay_installment_transfers_and_tracks() {
    let (env, client, token) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &(300_000_000i128),
        &3u32,
        &WEEK,
        &desc(&env, "grocery items"),
    );

    client.pay_installment(&customer, &utang_id);
    let utang = client.get_utang(&utang_id);
    assert_eq!(utang.installments_paid, 1);
    assert_eq!(utang.status, UtangStatus::Active);

    client.pay_installment(&customer, &utang_id);
    let utang = client.get_utang(&utang_id);
    assert_eq!(utang.installments_paid, 2);
    assert_eq!(utang.status, UtangStatus::Active);

    client.pay_installment(&customer, &utang_id);
    let utang = client.get_utang(&utang_id);
    assert_eq!(utang.installments_paid, 3);
    assert_eq!(utang.status, UtangStatus::Completed);
}

#[test]
#[should_panic(expected = "not the debtor")]
fn test_wrong_customer_cannot_pay_installment() {
    let (env, client, token) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let attacker = Address::generate(&env);
    mint_to(&env, &token, &attacker, 1_000_000_000i128);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &(300_000_000i128),
        &3u32,
        &WEEK,
        &desc(&env, "grocery items"),
    );

    client.pay_installment(&attacker, &utang_id);
}

#[test]
fn test_get_customer_utangs() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "rice"),
    );
    client.create_utang(
        &vendor,
        &customer,
        &200_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "pork"),
    );

    let utangs = client.get_customer_utangs(&customer, &10u32, &0u32);
    assert_eq!(utangs.len(), 2);
}

#[test]
fn test_get_vendor_utangs() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "fish"),
    );

    let utangs = client.get_vendor_utangs(&vendor, &10u32, &0u32);
    assert_eq!(utangs.len(), 1);
}

#[test]
fn test_mark_default() {
    let (env, _, token_address) = setup();
    let contract_id = env.register(UTangEscrow, ());
    let client = UTangEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &token_address);

    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "vegetables"),
    );

    // Advance past next_due + grace period.
    advance_time(&env, WEEK + WEEK + DAY);
    client.mark_default(&admin, &utang_id);
    let utang = client.get_utang(&utang_id);
    assert_eq!(utang.status, UtangStatus::Defaulted);
}

#[test]
#[should_panic]
fn test_mark_default_requires_admin_auth() {
    let (env, client, _) = setup_without_global_auth();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let admin = Address::generate(&env);
    let utang_id = client.mock_all_auths().create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "vegetables"),
    );

    client.mark_default(&admin, &utang_id);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_non_admin_cannot_mark_default() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let not_admin = Address::generate(&env);
    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "vegetables"),
    );

    client.mark_default(&not_admin, &utang_id);
}

#[test]
#[should_panic(expected = "utang not active")]
fn test_pay_completed_utang_panics() {
    let (env, client, token) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &1u32,
        &WEEK,
        &desc(&env, "spices"),
    );
    client.pay_installment(&customer, &utang_id);
    // Second call should panic — already completed
    client.pay_installment(&customer, &utang_id);
}

#[test]
#[should_panic(expected = "total_amount must be positive")]
fn test_zero_amount_panics() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    client.create_utang(
        &vendor,
        &customer,
        &0i128,
        &2u32,
        &WEEK,
        &desc(&env, ""),
    );
}

// ── New tests: default counters, reserve, late-fee resume, grace period ──

#[test]
#[should_panic(expected = "grace period not elapsed")]
fn test_mark_default_blocked_before_grace_elapsed() {
    let (env, client, _) = setup();
    let admin_addr: Address = env
        .as_contract(&client.address, || {
            env.storage().instance().get(&DataKey::Admin).unwrap()
        });
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "veg"),
    );
    // Past next_due but inside grace window.
    advance_time(&env, WEEK + DAY);
    client.mark_default(&admin_addr, &utang_id);
    let _ = utang_id;
}

#[test]
fn test_is_overdue_view() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "fish"),
    );
    assert!(!client.is_overdue(&utang_id));
    advance_time(&env, WEEK + DAY); // past due, inside grace
    assert!(!client.is_overdue(&utang_id));
    advance_time(&env, WEEK); // past grace
    assert!(client.is_overdue(&utang_id));
}

#[test]
fn test_default_counters_increment() {
    let (env, client, _) = setup();
    let admin_addr: Address = env
        .as_contract(&client.address, || {
            env.storage().instance().get(&DataKey::Admin).unwrap()
        });
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    assert_eq!(client.customer_defaults(&customer), 0);
    assert_eq!(client.vendor_defaults(&vendor), 0);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "veg"),
    );
    advance_time(&env, WEEK + WEEK + DAY);
    client.mark_default(&admin_addr, &utang_id);

    assert_eq!(client.customer_defaults(&customer), 1);
    assert_eq!(client.vendor_defaults(&vendor), 1);
}

#[test]
fn test_reserve_accumulates_and_pays_vendor_on_default() {
    let (env, client, token) = setup();
    let admin_addr: Address = env
        .as_contract(&client.address, || {
            env.storage().instance().get(&DataKey::Admin).unwrap()
        });
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &(300_000_000i128),
        &3u32,
        &WEEK,
        &desc(&env, "items"),
    );

    client.pay_installment(&customer, &utang_id);
    // 1% of 100M = 1M reserve.
    assert_eq!(client.utang_reserve(&utang_id), 1_000_000);

    let token_client = TokenClient::new(&env, &token);
    let vendor_before = token_client.balance(&vendor);

    // After 1 payment, next_due = 2*WEEK. Need now > next_due + grace (WEEK).
    advance_time(&env, 3 * WEEK + DAY);
    client.mark_default(&admin_addr, &utang_id);

    // Reserve transferred from contract to vendor.
    assert_eq!(client.utang_reserve(&utang_id), 0);
    assert_eq!(token_client.balance(&vendor), vendor_before + 1_000_000);
}

#[test]
fn test_reserve_refunds_customer_on_completion() {
    let (env, client, token) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let token_client = TokenClient::new(&env, &token);
    let customer_start = token_client.balance(&customer);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &(200_000_000i128),
        &2u32,
        &WEEK,
        &desc(&env, "items"),
    );
    client.pay_installment(&customer, &utang_id);
    client.pay_installment(&customer, &utang_id);

    let utang = client.get_utang(&utang_id);
    assert_eq!(utang.status, UtangStatus::Completed);
    // Reserve cleared.
    assert_eq!(client.utang_reserve(&utang_id), 0);
    // Customer paid exactly 200M total; reserve fees refunded on completion.
    assert_eq!(token_client.balance(&customer), customer_start - 200_000_000);
}

#[test]
fn test_resume_after_late_charges_fee_and_reactivates() {
    let (env, client, token) = setup();
    let admin_addr: Address = env
        .as_contract(&client.address, || {
            env.storage().instance().get(&DataKey::Admin).unwrap()
        });
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let token_client = TokenClient::new(&env, &token);

    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &200_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "items"),
    );

    advance_time(&env, WEEK + WEEK + DAY);
    client.mark_default(&admin_addr, &utang_id);
    assert_eq!(client.get_utang(&utang_id).status, UtangStatus::Defaulted);

    let vendor_before = token_client.balance(&vendor);
    client.resume_after_late(&customer, &utang_id);

    // Late fee = 5% of installment_amount (100M) = 5M.
    assert_eq!(token_client.balance(&vendor), vendor_before + 5_000_000);
    let u = client.get_utang(&utang_id);
    assert_eq!(u.status, UtangStatus::Active);
    assert!(u.next_due > env.ledger().timestamp());

    // After resume, customer can pay remaining installments.
    client.pay_installment(&customer, &utang_id);
    client.pay_installment(&customer, &utang_id);
    assert_eq!(client.get_utang(&utang_id).status, UtangStatus::Completed);
}

#[test]
#[should_panic(expected = "utang not defaulted")]
fn test_resume_active_utang_panics() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "x"),
    );
    client.resume_after_late(&customer, &utang_id);
}

#[test]
#[should_panic(expected = "not the debtor")]
fn test_resume_wrong_customer_panics() {
    let (env, client, _) = setup();
    let admin_addr: Address = env
        .as_contract(&client.address, || {
            env.storage().instance().get(&DataKey::Admin).unwrap()
        });
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let attacker = Address::generate(&env);
    let utang_id = client.create_utang(
        &vendor,
        &customer,
        &100_000_000i128,
        &2u32,
        &WEEK,
        &desc(&env, "x"),
    );
    advance_time(&env, WEEK + WEEK + DAY);
    client.mark_default(&admin_addr, &utang_id);
    client.resume_after_late(&attacker, &utang_id);
}

#[test]
fn test_grace_period_setter() {
    let (env, client, _) = setup();
    let admin_addr: Address = env
        .as_contract(&client.address, || {
            env.storage().instance().get(&DataKey::Admin).unwrap()
        });
    assert_eq!(client.grace_period(), WEEK);
    client.set_grace_period(&admin_addr, &(DAY * 3));
    assert_eq!(client.grace_period(), DAY * 3);
}
