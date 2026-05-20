#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

fn tx_hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn setup() -> (Env, Address, VendorRegistryClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VendorRegistry, ());
    let client = VendorRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, admin, client)
}

fn setup_without_global_auth() -> (Env, Address, VendorRegistryClient<'static>) {
    let env = Env::default();
    let contract_id = env.register(VendorRegistry, ());
    let client = VendorRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.mock_all_auths().initialize(&admin);
    (env, admin, client)
}

fn register(env: &Env, client: &VendorRegistryClient, admin: &Address, wallet: &Address) -> u64 {
    client.register_vendor(
        admin,
        wallet,
        &String::from_str(env, "marikina-public-market"),
        &String::from_str(env, "Aling Nena"),
        &String::from_str(env, "B-14"),
        &String::from_str(env, "+639171234567"),
        &String::from_str(env, "fish"),
    )
}

fn apply(env: &Env, client: &VendorRegistryClient, wallet: &Address) {
    client.apply_vendor(
        wallet,
        &String::from_str(env, "marikina-public-market"),
        &String::from_str(env, "Aling Rosa"),
        &String::from_str(env, "A-01"),
        &String::from_str(env, "+639181234567"),
        &String::from_str(env, "vegetables"),
    );
}

#[test]
fn test_register_vendor() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let id = register(&env, &client, &admin, &vendor);
    assert_eq!(id, 1);
    assert_eq!(client.vendor_count(), 1);
}

#[test]
fn test_get_vendor() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.wallet, vendor);
    assert_eq!(record.name, String::from_str(&env, "Aling Nena"));
    assert_eq!(record.stall_number, String::from_str(&env, "B-14"));
    assert_eq!(record.product_type, String::from_str(&env, "fish"));
    assert!(record.is_active);
}

#[test]
fn test_apply_and_approve() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);

    apply(&env, &client, &vendor);
    assert_eq!(client.pending_count(), 1);

    let app = client.get_application(&vendor);
    assert_eq!(app.status, ApplicationStatus::Pending);

    client.approve_vendor(&admin, &vendor);
    assert_eq!(client.pending_count(), 0);
    assert_eq!(client.vendor_count(), 1);

    let record = client.get_vendor(&vendor);
    assert_eq!(record.name, String::from_str(&env, "Aling Rosa"));
    assert!(record.is_active);
}

#[test]
#[should_panic]
fn test_apply_vendor_requires_wallet_auth() {
    let (env, _, client) = setup_without_global_auth();
    let vendor = Address::generate(&env);

    apply(&env, &client, &vendor);
}

#[test]
fn test_apply_and_reject() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);

    apply(&env, &client, &vendor);
    assert_eq!(client.pending_count(), 1);

    client.reject_vendor(&admin, &vendor);
    assert_eq!(client.pending_count(), 0);

    let app = client.get_application(&vendor);
    assert_eq!(app.status, ApplicationStatus::Rejected);
}

#[test]
fn test_get_pending_vendors() {
    let (env, admin, client) = setup();
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);

    apply(&env, &client, &v1);
    apply(&env, &client, &v2);
    assert_eq!(client.pending_count(), 2);

    let pending = client.get_pending_vendors(&10u32, &0u32);
    assert_eq!(pending.len(), 2);

    client.approve_vendor(&admin, &v1);
    assert_eq!(client.pending_count(), 1);
}

#[test]
fn test_get_all_vendors() {
    let (env, admin, client) = setup();
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);

    register(&env, &client, &admin, &v1);
    apply(&env, &client, &v2);
    client.approve_vendor(&admin, &v2);

    let all = client.get_all_vendors(&10u32, &0u32);
    assert_eq!(all.len(), 2);
}

#[test]
#[should_panic(expected = "application already pending")]
fn test_duplicate_application_panics() {
    let (env, _, client) = setup();
    let vendor = Address::generate(&env);
    apply(&env, &client, &vendor);
    apply(&env, &client, &vendor);
}

#[test]
fn test_update_profile() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    client.update_profile(
        &vendor,
        &String::from_str(&env, "Mang Ben"),
        &String::from_str(&env, "C-22"),
        &String::from_str(&env, "+639187654321"),
        &String::from_str(&env, "meat"),
    );
    let record = client.get_vendor(&vendor);
    assert_eq!(record.name, String::from_str(&env, "Mang Ben"));
}

#[test]
#[should_panic(expected = "vendor already registered")]
fn test_duplicate_registration_panics() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    register(&env, &client, &admin, &vendor);
}

#[test]
fn test_deactivate_vendor() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    client.deactivate_vendor(&admin, &vendor);
    let record = client.get_vendor(&vendor);
    assert!(!record.is_active);
}

#[test]
fn test_increment_stats() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    client.increment_stats(&admin, &vendor, &10_000_000i128);
    client.increment_stats(&admin, &vendor, &5_000_000i128);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_transactions, 2);
    assert_eq!(record.total_volume, 15_000_000i128);
}

#[test]
#[should_panic]
fn test_increment_stats_requires_admin_auth() {
    let (env, admin, client) = setup_without_global_auth();
    let vendor = Address::generate(&env);
    register(&env, &client.mock_all_auths(), &admin, &vendor);

    client.increment_stats(&admin, &vendor, &10_000_000i128);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_non_admin_cannot_increment_stats() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let not_admin = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    client.increment_stats(&not_admin, &vendor, &10_000_000i128);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_non_admin_cannot_register() {
    let (env, _, client) = setup();
    let not_admin = Address::generate(&env);
    let vendor = Address::generate(&env);
    register(&env, &client, &not_admin, &vendor);
}

// ── Reputation (ratings) ──────────────────────────────────────────────────────

#[test]
fn test_submit_rating_happy_path() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    let hash = tx_hash(&env, 1);
    client.submit_rating(&customer, &vendor, &hash, &5u32, &zero_hash(&env));

    let (sum, count) = client.get_vendor_rating(&vendor);
    assert_eq!(sum, 5);
    assert_eq!(count, 1);

    let r = client.get_rating(&vendor, &hash);
    assert_eq!(r.stars, 5);
    assert_eq!(r.customer, customer);
}

#[test]
fn test_rating_aggregates_average() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    client.submit_rating(&c1, &vendor, &tx_hash(&env, 1), &5u32, &zero_hash(&env));
    client.submit_rating(&c2, &vendor, &tx_hash(&env, 2), &4u32, &zero_hash(&env));
    client.submit_rating(&c3, &vendor, &tx_hash(&env, 3), &3u32, &zero_hash(&env));

    let (sum, count) = client.get_vendor_rating(&vendor);
    assert_eq!(sum, 12);
    assert_eq!(count, 3);
    // avg = 12/3 = 4.0
}

#[test]
fn test_has_rated() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    let hash = tx_hash(&env, 7);
    assert!(!client.has_rated(&vendor, &hash));

    client.submit_rating(&customer, &vendor, &hash, &4u32, &zero_hash(&env));
    assert!(client.has_rated(&vendor, &hash));
}

#[test]
fn test_get_vendor_rating_defaults_zero() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let (sum, count) = client.get_vendor_rating(&vendor);
    assert_eq!(sum, 0);
    assert_eq!(count, 0);
}

#[test]
#[should_panic(expected = "transaction already rated")]
fn test_double_rating_same_tx_panics() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    let hash = tx_hash(&env, 9);
    client.submit_rating(&customer, &vendor, &hash, &5u32, &zero_hash(&env));
    client.submit_rating(&customer, &vendor, &hash, &4u32, &zero_hash(&env));
}

#[test]
#[should_panic(expected = "stars must be 1-5")]
fn test_zero_stars_panics() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    client.submit_rating(
        &customer,
        &vendor,
        &tx_hash(&env, 1),
        &0u32,
        &zero_hash(&env),
    );
}

#[test]
#[should_panic(expected = "stars must be 1-5")]
fn test_six_stars_panics() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    client.submit_rating(
        &customer,
        &vendor,
        &tx_hash(&env, 1),
        &6u32,
        &zero_hash(&env),
    );
}

#[test]
#[should_panic(expected = "vendor not found")]
fn test_rating_unknown_vendor_panics() {
    let (env, _, client) = setup();
    let ghost = Address::generate(&env);
    let customer = Address::generate(&env);
    client.submit_rating(
        &customer,
        &ghost,
        &tx_hash(&env, 1),
        &5u32,
        &zero_hash(&env),
    );
}

#[test]
fn test_distinct_tx_hashes_allow_multiple_ratings() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    client.submit_rating(
        &customer,
        &vendor,
        &tx_hash(&env, 1),
        &5u32,
        &zero_hash(&env),
    );
    client.submit_rating(
        &customer,
        &vendor,
        &tx_hash(&env, 2),
        &3u32,
        &zero_hash(&env),
    );

    let (sum, count) = client.get_vendor_rating(&vendor);
    assert_eq!(sum, 8);
    assert_eq!(count, 2);
}
