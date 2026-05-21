# Contracts

## Current Testnet Contract IDs (redeployed 2026-05-21 with default-handling upgrade)

- Vendor Registry: `CDEQVKKRIXJHQRZCMOKE65LL2LMDXOY3MHKXQ2AP2DNHP56NPIT2NLJR`
- Palengke Payment: `CDSCCIT7L5ZNY5AYHOA2T6HMDEXFR7ZVR6JEWHJXXQCSILOMDOEKW5WY`
- Utang Escrow: `CCPYLRKBCM4SSQYNEETXDWANEQ3Q7AB7SBS254L3CHTEGQADTX5IOI53`
- Admin address: `GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH`
- Native XLM SAC bound to UTangEscrow: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

### 2026-05-21 default-handling upgrade

- `utang-escrow::mark_default` — admin auth + requires `now > next_due + grace_period` (default 7d)
- `utang-escrow::resume_after_late` — debtor auth, charges 5% of `installment_amount` to vendor, flips `Defaulted → Active`, resets `next_due`
- `utang-escrow::set_grace_period` — admin auth
- `utang-escrow::pay_installment` — now skims 1% of each payment to per-utang reserve; reserve pays out to vendor on default, refunds customer on completion
- New views: `customer_defaults`, `vendor_defaults`, `utang_reserve`, `is_overdue`, `grace_period`
- New events: `UtangDefaultedEvent`, `UtangResumedEvent`
- `vendor-registry::report_default` — admin auth, mirrors aggregate default counts
- New views: `vendor_defaults_received`, `customer_defaults_history`
- New event: `DefaultReportedEvent`

### Prior 2026-05-21 deploy (PR #3 auth hardening — still live)

- `vendor-registry::apply_vendor` — `wallet.require_auth()`
- `vendor-registry::increment_stats` — admin auth + positive amount
- `utang-escrow::create_utang` — `customer.require_auth()`
- `palengke-payment` — `CustomerPayments` index + `get_customer_payments`

## Deprecated / Replaced

- 2026-05-21 (PR #3, pre-default-handling) Vendor Registry: `CBVSUNNJWYSEUGVWACLQXV5UQHSW6ANB4Y2VBPULUNUW3LAOFZRZJHS5`
- 2026-05-21 (PR #3, pre-default-handling) Utang Escrow: `CBBK6NEHMLZX5GYWPEJAOXC2O4RYY745XMINQSR7R4LHLJH6NC5V2EZD`
- Pre-PR3 Vendor Registry: `CDSXO746SZFKUNT74GN4YEUUIH32IO6ALFLXVIORQESBQGNDVLD2UXUU` (admin `GBPPOLSXY...`)
- Pre-PR3 Palengke Payment: `CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF`
- Pre-PR3 Utang Escrow: `CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG`
- Original Vendor Registry (pre-rating fns): `CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH`

## Source of Truth Notes

- Contracts are compiled/tested in the workspace at `contracts/`.
- Payment and vendor/utang flows read from contract results first, with indexer fallback where implemented.

## Commands

- `cargo test --workspace`
- `cargo fmt --all -- --check`
- `cargo clippy --workspace -- -D warnings`
