#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, Address, VendorRegistryClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VendorRegistry);
    let client = VendorRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
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
    client.increment_stats(&vendor, &10_000_000i128);
    client.increment_stats(&vendor, &5_000_000i128);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_transactions, 2);
    assert_eq!(record.total_volume, 15_000_000i128);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_non_admin_cannot_register() {
    let (env, _, client) = setup();
    let not_admin = Address::generate(&env);
    let vendor = Address::generate(&env);
    register(&env, &client, &not_admin, &vendor);
}
