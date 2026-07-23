#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String, Vec};

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

/// Bootstraps a 2-of-2 multisig committee (via the admin-gated one-time
/// `migrate_to_multisig`) and returns its signer list — used by every test
/// that exercises a Phase-2-gated fn (`increment_stats`/`report_default`/
/// `set_payment_contract`/`set_escrow_contract`/`set_signers`/`upgrade`).
fn setup_with_multisig() -> (Env, Address, VendorRegistryClient<'static>, Vec<Address>) {
    let (env, admin, client) = setup();
    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(s1);
    signers.push_back(s2);
    client.migrate_to_multisig(&admin, &signers, &2u32);
    (env, admin, client, signers)
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
    let (env, admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    client.increment_stats(&signers, &vendor, &10_000_000i128);
    client.increment_stats(&signers, &vendor, &5_000_000i128);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_transactions, 2);
    assert_eq!(record.total_volume, 15_000_000i128);
}

#[test]
#[should_panic(expected = "multisig not configured")]
fn test_increment_stats_before_migration_panics() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let mut signers = Vec::new(&env);
    signers.push_back(admin.clone());
    // migrate_to_multisig was never called — the committee doesn't exist yet.
    client.increment_stats(&signers, &vendor, &10_000_000i128);
}

#[test]
#[should_panic]
fn test_increment_stats_requires_real_signer_auth() {
    let (env, admin, client) = setup_without_global_auth();
    let vendor = Address::generate(&env);
    register(&env, &client.mock_all_auths(), &admin, &vendor);
    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(s1);
    signers.push_back(s2);
    client
        .mock_all_auths()
        .migrate_to_multisig(&admin, &signers, &2u32);

    // No mock_all_auths active here — neither signer actually signed.
    client.increment_stats(&signers, &vendor, &10_000_000i128);
}

#[test]
#[should_panic(expected = "insufficient signers")]
fn test_increment_stats_rejects_under_threshold_signers() {
    let (env, admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    let mut one_signer = Vec::new(&env);
    one_signer.push_back(signers.get(0).unwrap());
    client.increment_stats(&one_signer, &vendor, &10_000_000i128);
}

#[test]
#[should_panic(expected = "duplicate signer")]
fn test_increment_stats_rejects_duplicate_signer() {
    let (env, admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    let s1 = signers.get(0).unwrap();
    let mut duped = Vec::new(&env);
    duped.push_back(s1.clone());
    duped.push_back(s1);
    client.increment_stats(&duped, &vendor, &10_000_000i128);
}

#[test]
#[should_panic(expected = "not a registered signer")]
fn test_increment_stats_rejects_unregistered_signer() {
    let (env, admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let mallory = Address::generate(&env);

    let mut bad_signers = Vec::new(&env);
    bad_signers.push_back(signers.get(0).unwrap());
    bad_signers.push_back(mallory);
    client.increment_stats(&bad_signers, &vendor, &10_000_000i128);
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

// ── Default tracking ─────────────────────────────────────────────────────────

#[test]
fn test_report_default_increments_counters() {
    let (env, _admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    assert_eq!(client.vendor_defaults_received(&vendor), 0);
    assert_eq!(client.customer_defaults_history(&customer), 0);

    client.report_default(&signers, &vendor, &customer);
    assert_eq!(client.vendor_defaults_received(&vendor), 1);
    assert_eq!(client.customer_defaults_history(&customer), 1);

    client.report_default(&signers, &vendor, &customer);
    assert_eq!(client.vendor_defaults_received(&vendor), 2);
    assert_eq!(client.customer_defaults_history(&customer), 2);
}

#[test]
#[should_panic(expected = "not a registered signer")]
fn test_unregistered_signer_cannot_report_default() {
    let (env, _admin, client, signers) = setup_with_multisig();
    let mallory = Address::generate(&env);
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);

    let mut bad_signers = Vec::new(&env);
    bad_signers.push_back(signers.get(0).unwrap());
    bad_signers.push_back(mallory);
    client.report_default(&bad_signers, &vendor, &customer);
}

#[test]
#[should_panic(expected = "multisig not configured")]
fn test_report_default_before_migration_panics() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(admin);
    client.report_default(&signers, &vendor, &customer);
}

// ── Credit scoring ──────────────────────────────────────────────────────────

#[test]
fn test_credit_score_unknown_vendor_is_floor() {
    let (env, _admin, client) = setup();
    let stranger = Address::generate(&env);
    // No record at all → 300 floor, no panic.
    assert_eq!(client.get_credit_score(&stranger), 300);
}

#[test]
fn test_credit_score_fresh_vendor_is_floor() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    // Registered but zero volume / txns / ratings → 300 floor.
    assert_eq!(client.get_credit_score(&vendor), 300);
}

#[test]
fn test_credit_score_builds_from_cashflow_and_ratings() {
    let (env, admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    // 12 txns, 120 XLM cumulative volume → +200 volume, +50 txns.
    for _ in 0..12 {
        client.increment_stats(&signers, &vendor, &100_000_000i128); // 10 XLM each
    }

    // Three 5-star ratings → avg 5.00 → +200.
    for i in 0..3u8 {
        let customer = Address::generate(&env);
        client.submit_rating(
            &customer,
            &vendor,
            &tx_hash(&env, i + 1),
            &5u32,
            &zero_hash(&env),
        );
    }

    // 300 + 200 + 50 + 200 = 750.
    assert_eq!(client.get_credit_score(&vendor), 750);
}

#[test]
fn test_credit_score_caps_at_850() {
    let (env, admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    // 500 txns at 10 XLM = 5000 XLM volume → +200 vol, +150 txns.
    for _ in 0..500 {
        client.increment_stats(&signers, &vendor, &100_000_000i128);
    }
    for i in 0..5u8 {
        let customer = Address::generate(&env);
        client.submit_rating(
            &customer,
            &vendor,
            &tx_hash(&env, i + 1),
            &5u32,
            &zero_hash(&env),
        );
    }
    // 300 + 200 + 150 + 200 = 850, clamped at ceiling.
    assert_eq!(client.get_credit_score(&vendor), 850);
}

#[test]
fn test_credit_score_default_penalty_floors_at_300() {
    let (env, admin, client, signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    // Modest profile: 10 txns + 100 XLM → 300 + 200 + 50 = 550.
    for _ in 0..10 {
        client.increment_stats(&signers, &vendor, &100_000_000i128);
    }
    assert_eq!(client.get_credit_score(&vendor), 550);

    // Six defaults × 100 penalty = 600 > 250 of headroom → clamped to 300 floor.
    for _ in 0..6 {
        let customer = Address::generate(&env);
        client.report_default(&signers, &vendor, &customer);
    }
    assert_eq!(client.get_credit_score(&vendor), 300);
}

// ── Pull-based credit-score oracle (Phase 1 fix) ───────────────────────────────
//
// Mocks mirror the REAL palengke-payment `Payment` / utang-escrow `Utang`
// structs field-for-field (superset of what vendor-registry's PaymentView/
// UtangView actually decode) so these tests prove the real cross-contract
// integration shape, not just self-consistency against a fabricated shape.

#[contract]
struct MockPayment;

#[contracttype]
#[derive(Clone)]
struct MockPaymentRecord {
    pub id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub memo: String,
}

#[contractimpl]
impl MockPayment {
    pub fn seed_payment(env: Env, payment_id: u64, customer: Address, vendor: Address, amount: i128) {
        env.storage().persistent().set(
            &payment_id,
            &MockPaymentRecord {
                id: payment_id,
                customer,
                vendor,
                amount,
                timestamp: 0,
                memo: String::from_str(&env, ""),
            },
        );
    }
    pub fn get_payment(env: Env, payment_id: u64) -> MockPaymentRecord {
        env.storage().persistent().get(&payment_id).unwrap()
    }
}

#[contract]
struct MockEscrow;

#[contracttype]
#[derive(Clone, PartialEq)]
enum MockUtangStatus {
    Active,
    Completed,
    Defaulted,
}

#[contracttype]
#[derive(Clone)]
struct MockUtangRecord {
    pub id: u64,
    pub customer: Address,
    pub vendor: Address,
    pub total_amount: i128,
    pub installment_amount: i128,
    pub installments_total: u32,
    pub installments_paid: u32,
    pub next_due: u64,
    pub interval_seconds: u64,
    pub status: MockUtangStatus,
    pub description: String,
}

#[contractimpl]
impl MockEscrow {
    #[allow(clippy::too_many_arguments)]
    pub fn seed_utang(
        env: Env,
        utang_id: u64,
        customer: Address,
        vendor: Address,
        total_amount: i128,
        installment_amount: i128,
        installments_paid: u32,
        status: MockUtangStatus,
    ) {
        env.storage().persistent().set(
            &utang_id,
            &MockUtangRecord {
                id: utang_id,
                customer,
                vendor,
                total_amount,
                installment_amount,
                installments_total: 0,
                installments_paid,
                next_due: 0,
                interval_seconds: 0,
                status,
                description: String::from_str(&env, ""),
            },
        );
    }
    pub fn get_utang(env: Env, utang_id: u64) -> MockUtangRecord {
        env.storage().persistent().get(&utang_id).unwrap()
    }
}

fn setup_with_sources(
    env: &Env,
    admin: &Address,
    client: &VendorRegistryClient,
) -> (Address, MockPaymentClient<'static>, Address, MockEscrowClient<'static>) {
    // set_payment_contract/set_escrow_contract are multisig-gated (Phase 2) —
    // bootstrap a throwaway committee here so these Phase-1-focused tests
    // don't need to thread signers through every call site.
    let s1 = Address::generate(env);
    let s2 = Address::generate(env);
    let mut signers = Vec::new(env);
    signers.push_back(s1);
    signers.push_back(s2);
    client.migrate_to_multisig(admin, &signers, &2u32);

    let payment_id = env.register(MockPayment, ());
    let payment = MockPaymentClient::new(env, &payment_id);
    let escrow_id = env.register(MockEscrow, ());
    let escrow = MockEscrowClient::new(env, &escrow_id);
    client.set_payment_contract(&signers, &payment_id);
    client.set_escrow_contract(&signers, &escrow_id);
    (payment_id, payment, escrow_id, escrow)
}

#[test]
fn test_record_activity_from_payment_credits_vendor_once() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let customer = Address::generate(&env);
    let (_, payment, _, _) = setup_with_sources(&env, &admin, &client);

    payment.seed_payment(&1u64, &customer, &vendor, &10_000_000i128);
    client.record_activity_from_payment(&1u64);

    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_transactions, 1);
    assert_eq!(record.total_volume, 10_000_000i128);

    // Calling again for the same payment_id must not double-count.
    client.record_activity_from_payment(&1u64);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_transactions, 1);
    assert_eq!(record.total_volume, 10_000_000i128);
}

#[test]
fn test_record_activity_from_payment_noop_for_unknown_vendor() {
    let (env, admin, client) = setup();
    let ghost_vendor = Address::generate(&env);
    let customer = Address::generate(&env);
    let (_, payment, _, _) = setup_with_sources(&env, &admin, &client);

    payment.seed_payment(&1u64, &customer, &ghost_vendor, &10_000_000i128);
    // Vendor was never registered in this registry — must not panic.
    client.record_activity_from_payment(&1u64);
}

#[test]
fn test_record_activity_from_installment_credits_delta_only() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let customer = Address::generate(&env);
    let (_, _, _, escrow) = setup_with_sources(&env, &admin, &client);

    // 4 installments of 25 each, total 100, evenly divisible.
    escrow.seed_utang(
        &1u64,
        &customer,
        &vendor,
        &100i128,
        &25i128,
        &1u32,
        &MockUtangStatus::Active,
    );
    client.record_activity_from_installment(&1u64);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_volume, 25i128);
    assert_eq!(record.total_transactions, 1);

    // installments_paid advances to 2 → only the new 25 should be added, not
    // the cumulative 50.
    escrow.seed_utang(
        &1u64,
        &customer,
        &vendor,
        &100i128,
        &25i128,
        &2u32,
        &MockUtangStatus::Active,
    );
    client.record_activity_from_installment(&1u64);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_volume, 50i128);
    assert_eq!(record.total_transactions, 2);

    // Calling again at the same installments_paid must not double-count.
    client.record_activity_from_installment(&1u64);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_volume, 50i128);
    assert_eq!(record.total_transactions, 2);
}

#[test]
fn test_record_activity_from_installment_handles_final_remainder_installment() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let customer = Address::generate(&env);
    let (_, _, _, escrow) = setup_with_sources(&env, &admin, &client);

    // total 100 over 3 installments of ceil(100/3)=34 → 34, 34, 34 would
    // overshoot to 102; final delta must be capped to the real remainder (32).
    escrow.seed_utang(
        &1u64,
        &customer,
        &vendor,
        &100i128,
        &34i128,
        &2u32,
        &MockUtangStatus::Active,
    );
    client.record_activity_from_installment(&1u64);
    let record = client.get_vendor(&vendor);
    assert_eq!(record.total_volume, 68i128); // 34 + 34, under total

    escrow.seed_utang(
        &1u64,
        &customer,
        &vendor,
        &100i128,
        &34i128,
        &3u32,
        &MockUtangStatus::Completed,
    );
    client.record_activity_from_installment(&1u64);
    let record = client.get_vendor(&vendor);
    // 100 total, capped — not 34*3=102.
    assert_eq!(record.total_volume, 100i128);
}

#[test]
fn test_record_default_from_utang_credits_once_and_only_when_defaulted() {
    let (env, admin, client) = setup();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);
    let customer = Address::generate(&env);
    let (_, _, _, escrow) = setup_with_sources(&env, &admin, &client);

    escrow.seed_utang(
        &1u64,
        &customer,
        &vendor,
        &100i128,
        &25i128,
        &1u32,
        &MockUtangStatus::Active,
    );
    // Active — must not bump default counters.
    client.record_default_from_utang(&1u64);
    assert_eq!(client.vendor_defaults_received(&vendor), 0);

    escrow.seed_utang(
        &1u64,
        &customer,
        &vendor,
        &100i128,
        &25i128,
        &1u32,
        &MockUtangStatus::Defaulted,
    );
    client.record_default_from_utang(&1u64);
    assert_eq!(client.vendor_defaults_received(&vendor), 1);
    assert_eq!(client.customer_defaults_history(&customer), 1);

    // Calling again for the same utang_id must not double-count.
    client.record_default_from_utang(&1u64);
    assert_eq!(client.vendor_defaults_received(&vendor), 1);
    assert_eq!(client.customer_defaults_history(&customer), 1);
}

#[test]
#[should_panic(expected = "not a registered signer")]
fn test_set_payment_contract_rejects_unregistered_signer() {
    let (env, _admin, client, signers) = setup_with_multisig();
    let mallory = Address::generate(&env);
    let fake_payment = Address::generate(&env);
    let mut bad_signers = Vec::new(&env);
    bad_signers.push_back(signers.get(0).unwrap());
    bad_signers.push_back(mallory);
    client.set_payment_contract(&bad_signers, &fake_payment);
}

#[test]
#[should_panic(expected = "not a registered signer")]
fn test_set_escrow_contract_rejects_unregistered_signer() {
    let (env, _admin, client, signers) = setup_with_multisig();
    let mallory = Address::generate(&env);
    let fake_escrow = Address::generate(&env);
    let mut bad_signers = Vec::new(&env);
    bad_signers.push_back(signers.get(0).unwrap());
    bad_signers.push_back(mallory);
    client.set_escrow_contract(&bad_signers, &fake_escrow);
}

// ── Phase 2: multisig bootstrap + rotation ─────────────────────────────────────

#[test]
#[should_panic(expected = "not admin")]
fn test_migrate_to_multisig_rejects_non_admin() {
    let (env, _admin, client) = setup();
    let not_admin = Address::generate(&env);
    let s1 = Address::generate(&env);
    let s2 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(s1);
    signers.push_back(s2);
    client.migrate_to_multisig(&not_admin, &signers, &2u32);
}

#[test]
#[should_panic(expected = "invalid threshold")]
fn test_migrate_to_multisig_rejects_threshold_zero() {
    let (env, admin, client) = setup();
    let s1 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(s1);
    client.migrate_to_multisig(&admin, &signers, &0u32);
}

#[test]
#[should_panic(expected = "invalid threshold")]
fn test_migrate_to_multisig_rejects_threshold_over_signer_count() {
    let (env, admin, client) = setup();
    let s1 = Address::generate(&env);
    let mut signers = Vec::new(&env);
    signers.push_back(s1);
    client.migrate_to_multisig(&admin, &signers, &2u32);
}

#[test]
#[should_panic(expected = "multisig already configured")]
fn test_migrate_to_multisig_cannot_run_twice() {
    let (env, admin, client, _signers) = setup_with_multisig();
    let s3 = Address::generate(&env);
    let mut new_signers = Vec::new(&env);
    new_signers.push_back(s3);
    client.migrate_to_multisig(&admin, &new_signers, &1u32);
}

#[test]
fn test_set_signers_rotates_committee_and_old_signers_then_fail() {
    let (env, admin, client, old_signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    let new1 = Address::generate(&env);
    let new2 = Address::generate(&env);
    let mut new_signers = Vec::new(&env);
    new_signers.push_back(new1);
    new_signers.push_back(new2);

    // Old committee authorizes the rotation.
    client.set_signers(&old_signers, &new_signers, &2u32);

    // New committee can now use the gated fns.
    client.increment_stats(&new_signers, &vendor, &10_000_000i128);
    assert_eq!(client.get_vendor(&vendor).total_transactions, 1);
}

#[test]
#[should_panic(expected = "not a registered signer")]
fn test_old_signers_fail_after_rotation() {
    let (env, admin, client, old_signers) = setup_with_multisig();
    let vendor = Address::generate(&env);
    register(&env, &client, &admin, &vendor);

    let new1 = Address::generate(&env);
    let new2 = Address::generate(&env);
    let mut new_signers = Vec::new(&env);
    new_signers.push_back(new1);
    new_signers.push_back(new2);
    client.set_signers(&old_signers, &new_signers, &2u32);

    // Old committee is no longer registered — must fail now.
    client.increment_stats(&old_signers, &vendor, &10_000_000i128);
}

#[test]
#[should_panic(expected = "multisig not configured")]
fn test_upgrade_requires_multisig() {
    let (env, admin, client) = setup();
    let dummy_hash = BytesN::from_array(&env, &[7u8; 32]);
    let mut signers = Vec::new(&env);
    signers.push_back(admin);
    // migrate_to_multisig never called — upgrade must not fall back to admin.
    client.upgrade(&signers, &dummy_hash);
}

// ── v1 → v2 vendor mirroring ────────────────────────────────────────────────
//
// Mock returns the REAL VendorRecord type (not a subset) — v1 and v2
// originated from identical source, so this is the actual shape v1 returns.

#[contract]
struct MockV1Registry;

#[contractimpl]
impl MockV1Registry {
    pub fn seed_v1_vendor(env: Env, wallet: Address, record: VendorRecord) {
        env.storage().persistent().set(&wallet, &record);
    }
    pub fn get_vendor(env: Env, wallet: Address) -> VendorRecord {
        env.storage().persistent().get(&wallet).unwrap()
    }
}

fn v1_record(env: &Env, wallet: &Address, name: &str) -> VendorRecord {
    VendorRecord {
        id: 1,
        wallet: wallet.clone(),
        market_id: String::from_str(env, "marikina-public-market"),
        name: String::from_str(env, name),
        stall_number: String::from_str(env, "V1-01"),
        phone: String::from_str(env, "+639170000001"),
        product_type: String::from_str(env, "fish"),
        registered_at: 0,
        total_transactions: 999, // deliberately nonzero — must NOT carry over
        total_volume: 999_000_000,
        is_active: true,
    }
}

#[test]
fn test_mirror_vendor_from_v1_creates_record_with_fresh_stats() {
    let (env, _admin, client, signers) = setup_with_multisig();
    let v1_id = env.register(MockV1Registry, ());
    let v1 = MockV1RegistryClient::new(&env, &v1_id);
    client.set_v1_registry(&signers, &v1_id);

    let wallet = Address::generate(&env);
    v1.seed_v1_vendor(&wallet, &v1_record(&env, &wallet, "Aling Rosa"));

    client.mirror_vendor_from_v1(&wallet);

    let record = client.get_vendor(&wallet);
    assert_eq!(record.name, String::from_str(&env, "Aling Rosa"));
    assert_eq!(record.stall_number, String::from_str(&env, "V1-01"));
    // Stats start fresh — v1's total_transactions/total_volume never carry over.
    assert_eq!(record.total_transactions, 0);
    assert_eq!(record.total_volume, 0);
}

#[test]
fn test_mirror_vendor_from_v1_noop_if_already_exists() {
    let (env, admin, client, signers) = setup_with_multisig();
    let v1_id = env.register(MockV1Registry, ());
    let v1 = MockV1RegistryClient::new(&env, &v1_id);
    client.set_v1_registry(&signers, &v1_id);

    let wallet = Address::generate(&env);
    register(&env, &client, &admin, &wallet); // native v2 vendor, "Aling Nena"
    v1.seed_v1_vendor(&wallet, &v1_record(&env, &wallet, "Different Name In V1"));

    client.mirror_vendor_from_v1(&wallet);

    // Existing v2 record must be untouched, not overwritten by v1's data.
    let record = client.get_vendor(&wallet);
    assert_eq!(record.name, String::from_str(&env, "Aling Nena"));
}

#[test]
#[should_panic(expected = "v1 registry not configured")]
fn test_mirror_vendor_from_v1_panics_when_not_configured() {
    let (env, _admin, client) = setup();
    let wallet = Address::generate(&env);
    client.mirror_vendor_from_v1(&wallet);
}

#[test]
#[should_panic(expected = "not a registered signer")]
fn test_set_v1_registry_rejects_unregistered_signer() {
    let (env, _admin, client, signers) = setup_with_multisig();
    let mallory = Address::generate(&env);
    let fake_v1 = Address::generate(&env);
    let mut bad_signers = Vec::new(&env);
    bad_signers.push_back(signers.get(0).unwrap());
    bad_signers.push_back(mallory);
    client.set_v1_registry(&bad_signers, &fake_v1);
}
