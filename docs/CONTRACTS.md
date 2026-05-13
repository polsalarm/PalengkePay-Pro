# PalengkePay Contracts

Last updated: 2026-05-13

This document summarizes the three Soroban contracts, their current public interfaces, auth boundaries, tests, and current frontend usage.

## 1. Contract Set

| Contract | Source | Current role |
| --- | --- | --- |
| `VendorRegistry` | `contracts/vendor-registry/src/lib.rs` | Vendor applications, admin approvals, vendor profiles, vendor counters |
| `PalengkePayment` | `contracts/palengke-payment/src/lib.rs` | Payment records, vendor payment lookup, payment events |
| `UTangEscrow` | `contracts/utang-escrow/src/lib.rs` | Installment agreements, installment repayment, default/completion state |

## 2. Deployed Testnet IDs

| Contract | Testnet ID |
| --- | --- |
| `VendorRegistry` | `CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH` |
| `PalengkePayment` | `CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF` |
| `UTangEscrow` | `CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG` |

Source: `README.md` and `contracts/README.md`.

## 3. VendorRegistry

### 3.1 Public Methods

| Method | Purpose | Auth |
| --- | --- | --- |
| `initialize(admin)` | Sets contract admin and initial counts | Initialization guard |
| `apply_vendor(wallet, name, stall_number, product_type, phone)` | Vendor submits application | `wallet.require_auth()` |
| `approve_vendor(admin, wallet)` | Admin approves pending vendor | `admin.require_auth()` and admin match |
| `reject_vendor(admin, wallet)` | Admin rejects pending vendor | `admin.require_auth()` and admin match |
| `register_vendor(admin, wallet, name, stall_number, product_type, phone)` | Admin directly registers vendor | `admin.require_auth()` and admin match |
| `update_profile(vendor, name, stall_number, product_type, phone)` | Vendor updates profile | `vendor.require_auth()` |
| `deactivate_vendor(admin, wallet)` | Admin deactivates vendor | `admin.require_auth()` and admin match |
| `increment_stats(admin, vendor, amount)` | Admin increments transaction count and volume | `admin.require_auth()` and admin match |
| `get_vendor(wallet)` | Reads vendor record | View |
| `get_application(wallet)` | Reads application record | View |
| `get_pending_vendors(limit, offset)` | Reads pending application page | View |
| `get_all_vendors(limit, offset)` | Reads vendor page | View |
| `vendor_count()` | Reads vendor count | View |
| `pending_count()` | Reads pending count | View |

### 3.2 Current Frontend Usage

- Vendor application: `frontend/src/pages/vendor/VendorApply.tsx`, `frontend/src/lib/hooks/useVendor.ts`
- Admin approval/rejection/deactivation: `frontend/src/pages/admin/AdminMarket.tsx`, `frontend/src/lib/hooks/useVendor.ts`
- Manual admin registration: `frontend/src/pages/admin/AdminRegister.tsx`
- Vendor profile/status reads: `frontend/src/pages/vendor/VendorProfile.tsx`, `frontend/src/lib/hooks/useVendor.ts`
- Admin metrics: `frontend/src/pages/admin/AdminMetrics.tsx`, `frontend/src/lib/hooks/useMetrics.ts`

### 3.3 Caveat

`increment_stats` is admin-only, positive-amount guarded, and now treated as a legacy fallback path. The frontend metrics layer prefers `PalengkePayment` records; the remaining hardening step is to retire this method or restrict it to an authorized payment-contract/event-normalizer path.

## 4. PalengkePayment

### 4.1 Public Methods

| Method | Purpose | Auth |
| --- | --- | --- |
| `initialize(admin, fee_bps, native_token)` | Sets admin, fee basis points, and token | Initialization guard |
| `pay(customer, vendor, amount, memo)` | Transfers/stores a payment and emits payment event | `customer.require_auth()` |
| `get_payment(payment_id)` | Reads payment record | View |
| `get_vendor_payments(vendor, limit, offset)` | Reads payment page for vendor | View |
| `get_customer_payments(customer, limit, offset)` | Reads payment page for customer history | View |
| `payment_count()` | Reads total payment count | View |

### 4.2 Current Frontend Usage

- The contract ID is configured with `VITE_PALENGKE_PAYMENT_CONTRACT_ID`.
- `frontend/src/lib/hooks/usePayment.ts` and `frontend/src/lib/contracts.ts` prefer `PalengkePayment.pay` when that contract ID is configured.
- `frontend/src/lib/payment-source.ts` normalizes `get_vendor_payments` / `get_customer_payments` records for metrics and history.
- `frontend/src/lib/hooks/useMetrics.ts` reads payment records first and falls back to registry counters only when payment reads are unavailable.
- `frontend/src/lib/hooks/useTransactions.ts` merges payment records with Horizon/localStorage fallback history.
- Direct Stellar payments via fee bump remain the missing-contract fallback.

### 4.3 Target Usage

Metrics, receipts, and future PalengkeScore inputs now have a shared `PalengkePayment` read model. The remaining deployment target is to redeploy the payment contract with `get_customer_payments`, then remove the registry metrics fallback.

## 5. UTangEscrow

### 5.1 Public Methods

| Method | Purpose | Auth |
| --- | --- | --- |
| `initialize(admin, native_token)` | Sets admin, token, and initial count | Initialization guard |
| `create_utang(customer, vendor, amount, installments, interval_days, memo)` | Creates an active installment agreement | `customer.require_auth()` |
| `pay_installment(customer, utang_id)` | Customer pays next installment | `customer.require_auth()` and debtor match |
| `mark_default(admin, utang_id)` | Admin marks active agreement defaulted | `admin.require_auth()` and admin match |
| `get_utang(utang_id)` | Reads agreement | View |
| `get_customer_utangs(customer, limit, offset)` | Reads customer agreement page | View |
| `get_vendor_utangs(vendor, limit, offset)` | Reads vendor agreement page | View |
| `utang_count()` | Reads total agreement count | View |

### 5.2 Current Frontend Usage

- Vendor offer payload generation: `frontend/src/pages/vendor/VendorUtang.tsx`
- Customer scan/upload/acceptance: `frontend/src/pages/customer/CustomerScan.tsx`, `frontend/src/pages/customer/CustomerUtang.tsx`
- Contract calls and reads: `frontend/src/lib/hooks/useUtang.ts`

### 5.3 Caveat

The current flow is customer-authorized creation from a vendor-generated offer payload. The target architecture is true on-chain vendor-offer/customer-accept, with partial pay, early settlement, due-state automation, and stronger receipts.

## 6. Contract Test Coverage

| Contract | Test file | Coverage summary |
| --- | --- | --- |
| `VendorRegistry` | `contracts/vendor-registry/src/test.rs` | registration, application, approve/reject, profile update, deactivation, stats, auth negative paths |
| `PalengkePayment` | `contracts/palengke-payment/src/test.rs` | initialize/count, payment creation, record reads, vendor payment reads, zero amount panic |
| `UTangEscrow` | `contracts/utang-escrow/src/test.rs` | create, pay, complete, default, list reads, wrong customer/admin negative paths |

## 7. Verification Commands

Run from `Stellar-PalengkePay-Pro`:

```powershell
cd .\contracts
cargo test --workspace
```

Additional recommended hardening:

```powershell
cd .\contracts
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
```

## 8. Contract Roadmap

1. Use payment events as the canonical source for payment history, metrics, and PalengkeScore.
2. Replace admin-only vendor stat updates with payment-derived updates.
3. Redesign utang as vendor-offer/customer-accept.
4. Add partial pay, early settlement, due-state logic, and richer repayment receipts.
5. Verify deployed contract IDs and WASM hashes after every testnet reset.
