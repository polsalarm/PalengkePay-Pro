# PalengkePay Verification Gates

Last updated: 2026-05-14

This document maps each important quality gate to the command or evidence that proves it. Use this before claiming the app is working, ready, deployed, or production-ready.

## 1. Gate Summary

| Gate | Command/evidence | Required before |
| --- | --- | --- |
| Frontend unit tests | `cd frontend; npm test` | Any fee-bump/security/payment-routing/history/metrics/quote claim |
| TypeScript check | `cd frontend; npx tsc --noEmit` | Any frontend code claim |
| Lint | `cd frontend; npm run lint` | Any frontend code claim |
| Production build | `cd frontend; npm run build` | Deployment or release claim |
| Visual route QA | `cd frontend; npm run qa:visual` | UI/responsive route claim |
| Dependency audit | `cd frontend; npm audit --audit-level=high` | Production-readiness or dependency-hardening claim |
| Secret pattern scan | `.github/workflows/security.yml` or equivalent local scan | Secret-scanning claim |
| CodeQL semantic scan | GitHub Security Scans workflow | Semantic/code-scanning claim |
| Contract tests | `cd contracts; cargo test --workspace` | Contract behavior/auth claim |
| Contract fmt/clippy | `cd contracts; cargo fmt --all -- --check`; `cargo clippy --workspace -- -D warnings` | Contract hardening claim |
| Health endpoint | `GET /api/health` locally or live | Runtime dependency claim |
| Admin health route | `/admin/health` route check | Browser-visible ops claim |
| Admin proof dashboard | `/admin/proofs` route check | Wallet-smoke proof/readiness claim |
| Live payment smoke | Wallet-signed testnet payment with hash | End-to-end payment claim |
| Receipt proof route | `/receipt/:txHash` with saved wallet proof | Local receipt recovery claim |
| Admin metrics smoke | `/admin/metrics` loads and labels `PalengkePayment` or registry fallback source | Metrics claim |
| Deployment smoke | Live landing, connect, health, key routes | Live/deployed claim |

## 2. Frontend Commands

Run from `Stellar-PalengkePay-Pro\frontend`.

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run qa:visual
npm audit --audit-level=high
```

Expected:

- Fee-bump, payment-routing, payment-source, payment-proof, vendor-QR, vendor-proof, and checkout quote test suites pass.
- TypeScript exits 0.
- ESLint exits 0.
- Vite build exits 0. The first-load app shell should remain code-split; large Stellar/wallet SDK chunks are expected only as deferred route or wallet-interaction chunks.
- Playwright route checks pass on desktop/mobile viewports. The QA command builds once, then runs desktop and mobile as separate Playwright invocations against static `dist/` test servers on `127.0.0.1:5173` and `127.0.0.1:5174` with service workers blocked and stale server reuse disabled.
- Audit exits 0 at `high` threshold. Low-severity transitive wallet findings must be tracked in `docs/DEPENDENCY_AUDIT.md`.

## 3. Contract Commands

Run from `Stellar-PalengkePay-Pro\contracts`.

```powershell
cargo test --workspace
```

If this Windows shell cannot find `cargo` on PATH, use the installed binary directly:

```powershell
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --workspace
```

Required hardening gates:

```powershell
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
```

Expected:

- All contract unit tests pass.
- Auth negative tests stay present for vendor application, vendor stats, utang creation, utang repayment, and defaulting.

## 4. API Checks

### 4.1 Health

Local or live:

```powershell
Invoke-WebRequest http://localhost:5173/api/health
```

Expected:

- JSON response reports `ok` when Horizon and Soroban RPC are reachable.
- JSON response includes `sponsor_rate_limit`.
- Production fee sponsorship readiness requires `sponsor_rate_limit` to report durable Redis REST configured.
- `degraded` is acceptable only when the failed dependency is explicitly documented.

### 4.2 Fee Bump

Do not test by pasting secrets. Use the automated test suite for policy checks and a wallet-generated signed XDR for manual smoke tests.

Policy coverage expected:

- signed inner source required,
- Testnet network passphrase required,
- `PP:` memo required,
- allowed operations only,
- amount and fee bounds,
- source signature check,
- optional destination allowlist,
- durable Redis REST rate limiting in production, with in-memory fallback only for local development.

## 5. Manual Route Smoke Matrix

| Route | What to verify |
| --- | --- |
| `/` | Landing loads and navigation works |
| `/connect` | Wallet options render |
| `/onboard` | Funding/role flow renders |
| `/market` | Market directory loads |
| `/vendor/apply` | Application form loads and validates required fields |
| `/vendor/home` | Vendor shell loads for connected wallet |
| `/vendor/qr` | QR generation surface loads |
| `/vendor/transactions` | History surface loads, can sync, searches receipt rows, shows income proof exports/certificate with receipt references, downloads a certificate packet, announces visible export/copy feedback, shows proof readiness, and exposes exact/latest receipt lookup/recovery controls |
| `/vendor/utang` | Utang offer form/QR surface loads |
| `/vendor/profile` | Profile state loads |
| `/customer/home` | Customer shell loads |
| `/customer/scan` | Scanner/manual payment form loads |
| `/customer/history` | History surface loads |
| `/customer/utang` | Customer utang list/actions load |
| `/receipt/:txHash` | Saved receipt proof route loads and links to Stellar Expert |
| `/admin/market` | Pending/active vendor lists load |
| `/admin/register` | Manual registration loads |
| `/admin/metrics` | Metrics dashboard loads |
| `/admin/health` | Health and public env readiness surface loads |
| `/admin/proofs` | Proof dashboard loads, shows sponsor status, receipt source mix, Testnet payment smoke status, review links, and captured-hash copy control |

## 6. Claim Rules

- Say "built" only when the code/docs exist in the repo.
- Say "passing" only when the command was run and exited 0.
- Say "deployed" only when a live URL was checked.
- Say "end-to-end working" only when browser/API/chain flow was actually exercised. Use `docs/MANUAL_E2E_RUNBOOK.md` for the wallet-signed proof path.
- Say "production-ready" only after secrets, durable rate limiting, deployment checks, contract tests, and live smoke checks pass.

## 7. Current Known Risks

- Production must redeploy `PalengkePayment` with `get_customer_payments` before customer history can rely fully on contract reads.
- Registry metrics fallback remains available and should be retired after contract reads are confirmed live.
- Fee-bump rate limiting is durable only when Redis REST env is configured; local in-memory fallback is not a production control.
- Production fee-bump rate limiting now fails closed unless durable Redis REST env is configured; this still needs Vercel env proof before production claims.
- Testnet reset can invalidate accounts/contracts.
- Mobile behavior still needs real-device verification.
- Wallet-backed E2E requires a signed Testnet transaction hash; automated Playwright route checks alone are not enough.
- Mainnet is not appropriate until contracts and deployment flow are audited.
