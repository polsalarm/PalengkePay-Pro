# Contracts

## Current Testnet Contract IDs (redeployed 2026-05-21 with PR #3 hardening)

- Vendor Registry: `CBVSUNNJWYSEUGVWACLQXV5UQHSW6ANB4Y2VBPULUNUW3LAOFZRZJHS5`
- Palengke Payment: `CDSCCIT7L5ZNY5AYHOA2T6HMDEXFR7ZVR6JEWHJXXQCSILOMDOEKW5WY`
- Utang Escrow: `CBBK6NEHMLZX5GYWPEJAOXC2O4RYY745XMINQSR7R4LHLJH6NC5V2EZD`
- Admin address: `GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH`

The 2026-05-21 deploy activated on-chain auth hardening from PR #3:

- `vendor-registry::apply_vendor` — `wallet.require_auth()`
- `vendor-registry::increment_stats` — admin auth + positive amount
- `utang-escrow::create_utang` — `customer.require_auth()`
- `palengke-payment` — `CustomerPayments` index + `get_customer_payments`

## Deprecated / Replaced

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
