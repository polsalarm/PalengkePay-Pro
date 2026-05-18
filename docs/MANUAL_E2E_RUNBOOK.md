# Manual E2E Runbook

## Preflight

1. Ensure local dependencies installed (`npm ci`, Rust toolchain).
2. Confirm contract env IDs are present for contract-first paths.

## Browser Check

1. Start app: `npm run dev` (frontend).
2. Walk these routes: `/`, `/connect`, `/onboard`, `/market`, `/vendor/home`, `/customer/home`, `/admin/health`, `/admin/proofs`.
3. Create non-sensitive payment proof flow and verify receipt view (`/receipt/demo-hash` for smoke).

## Serverless Check

1. Call `POST /api/fee-bump` with valid testnet inner tx in integration pass.
2. Call `GET /api/health` for runtime checks.
