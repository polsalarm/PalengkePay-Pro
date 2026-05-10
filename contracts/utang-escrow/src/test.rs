#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::StellarAssetClient,
    Address, Env, String,
};

fn setup() -> (Env, UTangEscrowClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = asset.address();

    let contract_id = env.register_contract(None, UTangEscrow);
    let client = UTangEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin, &token_address);

    (env, client, token_address)
}

fn mint_to(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

fn desc(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

#[test]
fn test_utang_count_starts_zero() {
    let (env, _, token_address) = setup();
    let contract_id = env.register_contract(None, UTangEscrow);
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
        &604800u64,
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
        &604800u64,
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
fn test_get_customer_utangs() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    client.create_utang(&vendor, &customer, &100_000_000i128, &2u32, &604800u64, &desc(&env, "rice"));
    client.create_utang(&vendor, &customer, &200_000_000i128, &2u32, &604800u64, &desc(&env, "pork"));

    let utangs = client.get_customer_utangs(&customer, &10u32, &0u32);
    assert_eq!(utangs.len(), 2);
}

#[test]
fn test_get_vendor_utangs() {
    let (env, client, _) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    client.create_utang(&vendor, &customer, &100_000_000i128, &2u32, &604800u64, &desc(&env, "fish"));

    let utangs = client.get_vendor_utangs(&vendor, &10u32, &0u32);
    assert_eq!(utangs.len(), 1);
}

#[test]
fn test_mark_default() {
    let (env, _, token_address) = setup();
    let contract_id = env.register_contract(None, UTangEscrow);
    let client = UTangEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &token_address);

    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let utang_id = client.create_utang(&vendor, &customer, &100_000_000i128, &2u32, &604800u64, &desc(&env, "vegetables"));

    client.mark_default(&admin, &utang_id);
    let utang = client.get_utang(&utang_id);
    assert_eq!(utang.status, UtangStatus::Defaulted);
}

#[test]
#[should_panic(expected = "utang not active")]
fn test_pay_completed_utang_panics() {
    let (env, client, token) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);

    let utang_id = client.create_utang(&vendor, &customer, &100_000_000i128, &1u32, &604800u64, &desc(&env, "spices"));
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
    client.create_utang(&vendor, &customer, &0i128, &2u32, &604800u64, &desc(&env, ""));
}
