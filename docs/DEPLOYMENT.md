# Deployment

## Environments

- Network: `testnet`.
- Frontend deploy target: Vercel static + serverless handlers.

## Local Commands

- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- `npm run qa:visual`
- `cargo test --workspace`, `cargo fmt --all -- --check`, `cargo clippy --workspace -- -D warnings`

## Runtime Variables

See `frontend/.env.example` for required and optional values.
Server-only secrets must remain only in Vercel env configuration, never in repo.

## Liquidity Rail Network Profiles

- `ANCHOR_NETWORK_PROFILE=testnet` is the default and must remain the hackathon QA path until the final switch.
- `ANCHOR_NETWORK_PROFILE=mainnet-ready` is documentation mode: the app reports missing production inputs through `/api/health`, but live fiat claims stay disabled.
- `ANCHOR_NETWORK_PROFILE=mainnet` requires:
  - `ANCHOR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015`
  - Mainnet Horizon and Soroban URLs.
  - Mainnet contract IDs verified or redeployed.
  - Funded and protected `ANCHOR_SIGNING_SECRET`.
  - `PDAX_MOCK=false` plus production provider credentials.
  - `RAMP_ADMIN_KEY`, `RAMP_WEBHOOK_SECRET`, KV/Redis, and fee sponsor rate-limit envs.
  - Final operator go/no-go after one Testnet wallet-signed payment proof.

If PDAX, GCash, or QR Ph partner access is not approved, Mainnet can only be described as operator-confirmed manual fiat settlement. Do not claim automated fiat settlement without webhook proof.

## Known Deployment Checklist

- Confirm Vercel envs and build settings.
- Run smoke on deployment URL and `/api/health`.
- Confirm live parity with latest code before claiming deployed status.
