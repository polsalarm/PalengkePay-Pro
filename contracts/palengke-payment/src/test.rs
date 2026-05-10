#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::StellarAssetClient,
    Address, Env, String,
};

fn setup() -> (Env, PalengkePaymentClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, PalengkePayment);
    let client = PalengkePaymentClient::new(&env, &contract_id);
    (env, client)
}

fn setup_initialized() -> (Env, PalengkePaymentClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = asset.address();

    let contract_id = env.register_contract(None, PalengkePayment);
    let client = PalengkePaymentClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin, &0u32, &token_address);

    (env, client, token_address)
}

fn mint_to(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

#[test]
fn test_payment_count_starts_zero() {
    let (_, client) = setup();
    assert_eq!(client.payment_count(), 0);
}

#[test]
fn test_pay_increments_count() {
    let (env, client, token) = setup_initialized();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "2kg tilapia");

    client.pay(&customer, &vendor, &10_000_000i128, &memo);
    assert_eq!(client.payment_count(), 1);

    client.pay(&customer, &vendor, &5_000_000i128, &memo);
    assert_eq!(client.payment_count(), 2);
}

#[test]
fn test_get_payment_returns_correct_data() {
    let (env, client, token) = setup_initialized();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "1kg bangus");

    let payment_id = client.pay(&customer, &vendor, &15_000_000i128, &memo);
    let payment = client.get_payment(&payment_id);

    assert_eq!(payment.customer, customer);
    assert_eq!(payment.vendor, vendor);
    assert_eq!(payment.amount, 15_000_000i128);
}

#[test]
fn test_get_vendor_payments() {
    let (env, client, token) = setup_initialized();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "fish");

    client.pay(&customer, &vendor, &10_000_000i128, &memo);
    client.pay(&customer, &vendor, &20_000_000i128, &memo);

    let payments = client.get_vendor_payments(&vendor, &10u32, &0u32);
    assert_eq!(payments.len(), 2);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_zero_amount_panics() {
    let (env, client) = setup();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    let memo = String::from_str(&env, "test");
    client.pay(&customer, &vendor, &0i128, &memo);
}
