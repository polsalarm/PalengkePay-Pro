# PalengkePay Deployment Guide

Last updated: 2026-05-13

This guide documents local setup, environment variables, deployment checks, and production caveats for the current Vite/Vercel/Stellar Testnet app.

## 1. Project Roots

| Area | Path |
| --- | --- |
| Workspace root | `C:\Codes Local\Hackathons (Workspace)\05-13-26 - PalengkePay` |
| App root | `C:\Codes Local\Hackathons (Workspace)\05-13-26 - PalengkePay\Stellar-PalengkePay-Pro` |
| Frontend root | `Stellar-PalengkePay-Pro\frontend` |
| Contracts root | `Stellar-PalengkePay-Pro\contracts` |

## 2. Local Prerequisites

- Node.js 20+
- npm
- Rust stable toolchain
- Visual Studio Build Tools with C++ workload on Windows, required for local Rust contract tests
- Stellar wallet for manual app testing
- Optional mobile wallet: LOBSTR via WalletConnect

## 3. Frontend Setup

```powershell
cd "C:\Codes Local\Hackathons (Workspace)\05-13-26 - PalengkePay\Stellar-PalengkePay-Pro\frontend"
npm install --legacy-peer-deps
npm run dev
```

Default dev server:

```text
http://localhost:5173
```

## 4. Frontend Environment Variables

Configured in `frontend/.env.local` for local work and Vercel environment variables for deployment.

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `VITE_STELLAR_NETWORK` | Client | Yes | Expected value: `testnet` |
| `VITE_SOROBAN_RPC_URL` | Client | Yes | Soroban RPC endpoint |
| `VITE_VENDOR_REGISTRY_CONTRACT_ID` | Client | Yes for vendor/admin flows | VendorRegistry contract ID |
| `VITE_PALENGKE_PAYMENT_CONTRACT_ID` | Client | Yes for contract-first QR payments | PalengkePayment contract ID |
| `VITE_UTANG_ESCROW_CONTRACT_ID` | Client | Yes for utang flows | UTangEscrow contract ID |
| `VITE_UTANG_FEE_XLM` | Client | Optional | Vendor fee per utang QR creation |
| `VITE_FEE_BUMP_URL` | Client | Yes for gasless payments | Fee-bump API path, usually `/api/fee-bump` |
| `VITE_SENTRY_DSN` | Client | Optional | Enables Sentry when present |

## 5. Server/API Environment Variables

These are server-side only. Do not expose raw values in frontend code, README examples, screenshots, or chat.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPONSOR_SECRET` | Yes for fee sponsorship | Funded Stellar Testnet sponsor secret |
| `FEE_BUMP_ALLOWED_DESTINATIONS` | Strongly recommended | Comma-separated approved destination accounts |
| `FEE_BUMP_RATE_LIMIT_WINDOW_MS` | Optional | Per-IP in-memory rate-limit window |
| `FEE_BUMP_RATE_LIMIT_MAX` | Optional | Per-IP in-memory max requests per window |
| `FEE_BUMP_MAX_INNER_XDR_BYTES` | Optional | Max inner transaction payload size |
| `FEE_BUMP_MAX_INNER_FEE_STROOPS` | Optional | Max inner fee |
| `FEE_BUMP_MAX_SPONSORED_OPS` | Optional | Max sponsored operation count |
| `FEE_BUMP_MAX_SPONSORED_XLM` | Optional | Max sponsored payment/createAccount amount |
| `SOROBAN_RPC_URL` | Optional server health override | RPC endpoint for `/api/health` |

## 6. Vercel Deployment

Expected Vercel layout:

- Frontend build root: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- API functions: `frontend/api/*.ts`
- Vercel config: `frontend/vercel.json`

Deployment checklist:

1. Set client env vars in Vercel.
2. Set server-only fee-bump env vars in Vercel.
3. Confirm `frontend/vercel.json` preserves `/api/*` routing.
4. Build with Testnet contract IDs.
5. Check `/api/health`.
6. Smoke-test connect, vendor QR, customer scan, fee-bump payment, transaction history, admin market, and metrics.
7. Verify no raw secrets appear in build logs or frontend bundle.

## 7. Verification Before Deploy

From app root:

```powershell
cd .\frontend
npm test -- api/fee-bump.test.ts
npx tsc --noEmit
npm run lint
npm run build
npm run qa:visual
```

From app root:

```powershell
cd .\contracts
cargo test --workspace
```

## 8. Live Smoke Checks

After deployment:

| Check | Expected result |
| --- | --- |
| `GET /` | Landing page loads |
| `GET /connect` | Wallet connect page loads |
| `GET /api/health` | Returns `ok` or clearly reports degraded dependency |
| Customer QR payment | Wallet signs `PalengkePayment.pay`, transaction hash appears |
| Vendor transaction history | Recent payment appears after Horizon sync |
| Admin market | Pending/active vendor lists load |
| Admin metrics | Metrics page loads from registry state |

## 9. Production Caveats

- Direct Stellar transfer plus fee bump remains available only as the missing-contract fallback.
- Serverless in-memory rate limits are not durable across instances.
- Testnet resets can invalidate contract IDs, account state, and sponsor balances.
- Mainnet deployment should wait for architecture finalization, contract audit, durable rate limiting, and full deployment runbook proof.

## 10. Reset Recovery

If Stellar Testnet resets:

1. Re-fund deployer/admin/sponsor accounts.
2. Rebuild and redeploy contracts.
3. Initialize contract admin/native token state.
4. Update Vercel/client env contract IDs.
5. Update README/docs contract IDs and proof screenshots.
6. Run contract tests, frontend build, health check, and route smoke checks.
7. Re-seed demo vendors/customers if needed.
