# PalengkePay — Smart Contracts

Three Soroban contracts on Stellar Testnet.

## Auth Hardening (deployed 2026-05-21)

PR #3 added these on-chain auth checks. Live on the contract IDs below as of the
2026-05-21 redeploy.

| Contract | Hardening |
|----------|-----------|
| `vendor-registry` | `apply_vendor` requires `wallet.require_auth()`; `increment_stats` requires admin auth + positive amount |
| `utang-escrow` | `create_utang` requires `customer.require_auth()` |
| `palengke-payment` | adds `CustomerPayments` index + `get_customer_payments(customer, limit, offset)` |

### Deployed WASM (2026-05-21)

| WASM | Bytes | SHA-256 |
|------|------:|---------|
| `palengke_payment.wasm` | 6 767 | `8412cb133a438e10b47be050fa7cba0d272f9e8304a0e366a842663cbb6fbc0b` |
| `vendor_registry.wasm` | 15 148 | `d3ecffc9544e816d6301c29bf7438f06a23f86a310b23efb1965bbfd483a4f08` |
| `utang_escrow.wasm` | 11 955 | `4bf43dc839cb9e4b2b5b8d882bd42631448421231949482d5458f7a71453a7b5` |

Admin keypair on the new contracts: `GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH`
(== `stellar keys address palengkepay`). Pre-PR3 admin `GBPPOLSXY...` is no longer the
admin of any live contract.

## Contracts

| Contract | Contract ID | Description |
|----------|-------------|-------------|
| `vendor-registry` | `CBVSUNNJWYSEUGVWACLQXV5UQHSW6ANB4Y2VBPULUNUW3LAOFZRZJHS5` | On-chain vendor identity — register, apply, approve, deactivate, stats |
| `palengke-payment` | `CDSCCIT7L5ZNY5AYHOA2T6HMDEXFR7ZVR6JEWHJXXQCSILOMDOEKW5WY` | QR-based XLM payment settlement with fee support |
| `utang-escrow` | `CBBK6NEHMLZX5GYWPEJAOXC2O4RYY745XMINQSR7R4LHLJH6NC5V2EZD` | BNPL installment agreements — create, pay, complete, default |

### VendorRegistry

`CBVSUNNJWYSEUGVWACLQXV5UQHSW6ANB4Y2VBPULUNUW3LAOFZRZJHS5` · [View on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CBVSUNNJWYSEUGVWACLQXV5UQHSW6ANB4Y2VBPULUNUW3LAOFZRZJHS5)

<img src="../UI/CONTRACT/VendorRegistry.png" alt="VendorRegistry contract on Stellar Expert" width="100%" />

### PalengkePayment

`CDSCCIT7L5ZNY5AYHOA2T6HMDEXFR7ZVR6JEWHJXXQCSILOMDOEKW5WY` · [View on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CDSCCIT7L5ZNY5AYHOA2T6HMDEXFR7ZVR6JEWHJXXQCSILOMDOEKW5WY)

<img src="../UI/CONTRACT/PalengkeyPayment.png" alt="PalengkePayment contract on Stellar Expert" width="100%" />

### UTangEscrow

`CBBK6NEHMLZX5GYWPEJAOXC2O4RYY745XMINQSR7R4LHLJH6NC5V2EZD` · [View on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CBBK6NEHMLZX5GYWPEJAOXC2O4RYY745XMINQSR7R4LHLJH6NC5V2EZD)

<img src="../UI/CONTRACT/UtangEscrow.png" alt="UTangEscrow contract on Stellar Expert" width="100%" />

## Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add wasm32 target
rustup target add wasm32v1-none

# Install Stellar CLI 25.2+
cargo install --locked stellar-cli --features opt
```

## Build

```bash
cd contracts
stellar contract build
```

Or per-contract:

```bash
cd contracts/vendor-registry   && cargo build --release --target wasm32v1-none
cd contracts/palengke-payment  && cargo build --release --target wasm32v1-none
cd contracts/utang-escrow      && cargo build --release --target wasm32v1-none
```

## Test

```bash
cd contracts
cargo test --workspace
```

Or per-contract:

```bash
cd contracts/vendor-registry   && cargo test
cd contracts/palengke-payment  && cargo test
cd contracts/utang-escrow      && cargo test
```

## Deploy to Testnet

```bash
# Fund a testnet account (once)
stellar keys generate admin --network testnet
stellar keys fund admin --network testnet

# 1 — Deploy & initialize VendorRegistry
stellar contract deploy \
  --wasm contracts/vendor-registry/target/wasm32v1-none/release/vendor_registry.wasm \
  --source admin \
  --network testnet

stellar contract invoke \
  --id <VENDOR_REGISTRY_CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address admin)

# 2 — Deploy & initialize PalengkePayment
stellar contract deploy \
  --wasm contracts/palengke-payment/target/wasm32v1-none/release/palengke_payment.wasm \
  --source admin \
  --network testnet

stellar contract invoke \
  --id <PALENGKE_PAYMENT_CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address admin) \
  --fee_bps 0 \
  --token $(stellar contract id asset --asset native --network testnet)

# 3 — Deploy & initialize UTangEscrow
stellar contract deploy \
  --wasm contracts/utang-escrow/target/wasm32v1-none/release/utang_escrow.wasm \
  --source admin \
  --network testnet

stellar contract invoke \
  --id <UTANG_ESCROW_CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address admin) \
  --token $(stellar contract id asset --asset native --network testnet)
```

## Redeploy Only PalengkePayment

Use this when the payment contract source changes but the registry and utang contracts can stay as-is.

```powershell
cd "C:\Codes Local\Hackathons (Workspace)\05-13-26 - PalengkePay\Stellar-PalengkePay-Pro\contracts"

# Verify and build
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --workspace
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --release --target wasm32v1-none -p palengke-payment

# Deploy the new payment contract
$NEW_PAYMENT_ID = stellar contract deploy `
  --wasm .\target\wasm32v1-none\release\palengke_payment.wasm `
  --source admin `
  --network testnet

# Initialize with native XLM
$ADMIN_ADDRESS = stellar keys address admin
$NATIVE_TOKEN = stellar contract id asset --asset native --network testnet

stellar contract invoke `
  --id $NEW_PAYMENT_ID `
  --source admin `
  --network testnet `
  -- initialize `
  --admin $ADMIN_ADDRESS `
  --fee_bps 0 `
  --native_token $NATIVE_TOKEN

# Smoke the new customer-history view method
stellar contract invoke `
  --id $NEW_PAYMENT_ID `
  --source admin `
  --network testnet `
  -- get_customer_payments `
  --customer $ADMIN_ADDRESS `
  --limit 1 `
  --offset 0
```

After redeploy, update `VITE_PALENGKE_PAYMENT_CONTRACT_ID` in `frontend/.env.local`, Vercel env vars, `README.md`, `contracts/README.md`, and `docs/CONTRACTS.md`.

## After Deploy

Add contract IDs to `frontend/.env.local`:

```env
VITE_STELLAR_NETWORK=testnet
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_VENDOR_REGISTRY_CONTRACT_ID=<VENDOR_REGISTRY_CONTRACT_ID>
VITE_PALENGKE_PAYMENT_CONTRACT_ID=<PALENGKE_PAYMENT_CONTRACT_ID>
VITE_UTANG_ESCROW_CONTRACT_ID=<UTANG_ESCROW_CONTRACT_ID>
VITE_UTANG_FEE_XLM=1
```

## Generate TypeScript Bindings (optional)

```bash
stellar contract bindings typescript \
  --network testnet \
  --id <VENDOR_REGISTRY_CONTRACT_ID> \
  --output-dir frontend/src/lib/bindings/vendor-registry

stellar contract bindings typescript \
  --network testnet \
  --id <PALENGKE_PAYMENT_CONTRACT_ID> \
  --output-dir frontend/src/lib/bindings/palengke-payment

stellar contract bindings typescript \
  --network testnet \
  --id <UTANG_ESCROW_CONTRACT_ID> \
  --output-dir frontend/src/lib/bindings/utang-escrow
```
