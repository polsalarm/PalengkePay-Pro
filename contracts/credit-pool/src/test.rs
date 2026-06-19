#![cfg(test)]
use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ── Mock VendorRegistry exposing a settable get_credit_score ────────────────
#[contract]
struct MockRegistry;

#[contractimpl]
impl MockRegistry {
    pub fn set_score(env: Env, vendor: Address, score: u32) {
        env.storage().persistent().set(&vendor, &score);
    }
    pub fn get_credit_score(env: Env, vendor: Address) -> u32 {
        env.storage().persistent().get(&vendor).unwrap_or(300)
    }
}

struct Harness<'a> {
    env: Env,
    pool: CreditPoolClient<'a>,
    registry: MockRegistryClient<'a>,
    usdc: TokenClient<'a>,
    usdc_admin: StellarAssetClient<'a>,
}

fn setup<'a>() -> Harness<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    let usdc = env.register_stellar_asset_contract_v2(issuer);
    let usdc_addr = usdc.address();

    let registry_id = env.register(MockRegistry, ());
    let registry = MockRegistryClient::new(&env, &registry_id);

    let pool_id = env.register(CreditPool, ());
    let pool = CreditPoolClient::new(&env, &pool_id);
    pool.initialize(&admin, &usdc_addr, &registry_id);

    Harness {
        usdc: TokenClient::new(&env, &usdc_addr),
        usdc_admin: StellarAssetClient::new(&env, &usdc_addr),
        env,
        pool,
        registry,
    }
}

const USDC: i128 = 10_000_000; // 1 USDC at 7 decimals

#[test]
fn test_deposit_funds_pool() {
    let h = setup();
    let lp = Address::generate(&h.env);
    h.usdc_admin.mint(&lp, &(1_000 * USDC));

    h.pool.deposit(&lp, &(500 * USDC));
    assert_eq!(h.pool.pool_balance(), 500 * USDC);
    assert_eq!(h.usdc.balance(&lp), 500 * USDC);
}

#[test]
fn test_credit_limit_scales_with_score() {
    let h = setup();
    let vendor = Address::generate(&h.env);
    h.registry.set_score(&vendor, &800u32);
    // (800 - 500) points * 1 USDC = 300 USDC line.
    assert_eq!(h.pool.credit_limit(&vendor), 300 * USDC);
}

#[test]
fn test_below_min_score_no_line() {
    let h = setup();
    let vendor = Address::generate(&h.env);
    h.registry.set_score(&vendor, &450u32); // under 500 floor
    assert_eq!(h.pool.credit_limit(&vendor), 0);
    assert_eq!(h.pool.available_to(&vendor), 0);
}

#[test]
fn test_available_capped_by_liquidity() {
    let h = setup();
    let lp = Address::generate(&h.env);
    let vendor = Address::generate(&h.env);
    h.usdc_admin.mint(&lp, &(1_000 * USDC));
    h.pool.deposit(&lp, &(50 * USDC)); // only 50 USDC liquidity
    h.registry.set_score(&vendor, &850u32); // 350 USDC line

    // Headroom 350 USDC but pool only holds 50 → capped at 50.
    assert_eq!(h.pool.available_to(&vendor), 50 * USDC);
}

#[test]
fn test_draw_transfers_and_records_debt() {
    let h = setup();
    let lp = Address::generate(&h.env);
    let vendor = Address::generate(&h.env);
    h.usdc_admin.mint(&lp, &(1_000 * USDC));
    h.pool.deposit(&lp, &(500 * USDC));
    h.registry.set_score(&vendor, &800u32); // 300 USDC line

    h.pool.draw(&vendor, &(120 * USDC));

    assert_eq!(h.usdc.balance(&vendor), 120 * USDC);
    assert_eq!(h.pool.debt(&vendor), 120 * USDC);
    assert_eq!(h.pool.pool_balance(), 380 * USDC);
    // Remaining headroom = 300 - 120 = 180 USDC.
    assert_eq!(h.pool.available_to(&vendor), 180 * USDC);
}

#[test]
#[should_panic(expected = "exceeds available credit")]
fn test_draw_over_limit_panics() {
    let h = setup();
    let lp = Address::generate(&h.env);
    let vendor = Address::generate(&h.env);
    h.usdc_admin.mint(&lp, &(1_000 * USDC));
    h.pool.deposit(&lp, &(500 * USDC));
    h.registry.set_score(&vendor, &800u32); // 300 USDC line

    h.pool.draw(&vendor, &(301 * USDC));
}

#[test]
#[should_panic(expected = "exceeds available credit")]
fn test_low_score_vendor_cannot_draw() {
    let h = setup();
    let lp = Address::generate(&h.env);
    let vendor = Address::generate(&h.env);
    h.usdc_admin.mint(&lp, &(1_000 * USDC));
    h.pool.deposit(&lp, &(500 * USDC));
    h.registry.set_score(&vendor, &400u32); // no line

    h.pool.draw(&vendor, &(1 * USDC));
}

#[test]
fn test_repay_reduces_debt_and_clamps_overpay() {
    let h = setup();
    let lp = Address::generate(&h.env);
    let vendor = Address::generate(&h.env);
    h.usdc_admin.mint(&lp, &(1_000 * USDC));
    h.pool.deposit(&lp, &(500 * USDC));
    h.registry.set_score(&vendor, &800u32);

    h.pool.draw(&vendor, &(100 * USDC));
    assert_eq!(h.pool.debt(&vendor), 100 * USDC);

    // Partial repay.
    h.pool.repay(&vendor, &(40 * USDC));
    assert_eq!(h.pool.debt(&vendor), 60 * USDC);

    // Overpay clamps to remaining 60, only 60 pulled.
    h.pool.repay(&vendor, &(1_000 * USDC));
    assert_eq!(h.pool.debt(&vendor), 0);
    // Drew 100, repaid 100 → vendor net zero from borrowing.
    assert_eq!(h.usdc.balance(&vendor), 0);
    assert_eq!(h.pool.pool_balance(), 500 * USDC);
}
