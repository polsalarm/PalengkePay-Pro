# Contracts

## Current Contract IDs (from local docs)

- Vendor Registry: `CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH`
- Palengke Payment: `CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF`
- Utang Escrow: `CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG`

## Source of Truth Notes

- Contracts are compiled/tested in the workspace at `contracts/`.
- Payment and vendor/utang flows read from contract results first, with indexer fallback where implemented.

## Commands

- `cargo test --workspace`
- `cargo fmt --all -- --check`
- `cargo clippy --workspace -- -D warnings`
