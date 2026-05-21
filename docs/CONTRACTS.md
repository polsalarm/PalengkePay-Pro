# Contracts

## Current Testnet Contract IDs

- Vendor Registry: `CDSXO746SZFKUNT74GN4YEUUIH32IO6ALFLXVIORQESBQGNDVLD2UXUU`
- Palengke Payment: `CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF`
- Utang Escrow: `CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG`
- Admin address: `GBPPOLSXYYPJYA7G5CL5IC27JYQO5RX25RZC27Q2EUJLCDJISPN5SYRR`

## Deprecated / Replaced

- Old Vendor Registry (pre-rating fns): `CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH`

## Pending Redeploy

The PR #3 hardening added these on-chain auth checks that are NOT yet live:

- `vendor-registry::apply_vendor` — `wallet.require_auth()`
- `vendor-registry::increment_stats` — admin auth + positive amount
- `utang-escrow::create_utang` — `customer.require_auth()`
- `palengke-payment` — `CustomerPayments` index + `get_customer_payments`

The live testnet contracts above still run the pre-PR WASM. To activate the
hardening, rebuild and redeploy each contract, capture the new contract IDs,
and update `frontend/.env.local` (and Vercel project env). Redeploy is
non-idempotent — new WASM = new contract ID.

## Source of Truth Notes

- Contracts are compiled/tested in the workspace at `contracts/`.
- Payment and vendor/utang flows read from contract results first, with indexer fallback where implemented.

## Commands

- `cargo test --workspace`
- `cargo fmt --all -- --check`
- `cargo clippy --workspace -- -D warnings`
