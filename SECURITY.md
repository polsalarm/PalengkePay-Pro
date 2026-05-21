# Security Policy

PalengkePay is currently a Stellar Testnet project. Do not use Mainnet funds with this codebase until contracts, deployment operations, and server-side protections have been audited.

## Supported Scope

Security reports should focus on:

- Fee sponsorship abuse paths.
- Server-only secret exposure.
- Wallet signing and transaction construction.
- Soroban contract authorization boundaries.
- Input handling and unsafe rendering.
- Deployment headers and API routing.
- Testnet contract or account state assumptions.

## Reporting

Do not open a public issue for exploitable vulnerabilities. Contact the project maintainer privately with:

- A short summary.
- Affected route, API, contract, or file.
- Reproduction steps.
- Expected impact.
- Suggested fix, if known.

Never include raw private keys, sponsor secrets, seed output, or third-party credentials in a report.

## Current Controls

- Fee-bump API requires signed Testnet inner transactions.
- Fee-bump API requires `PP:` PalengkePay memos.
- Fee-bump sponsorship is limited to native XLM `payment` and `createAccount` operations.
- Fee-bump API enforces operation count, fee, XDR size, amount, signature, and optional destination allowlist checks.
- Fee-bump API uses Upstash Redis / Vercel KV-compatible REST counters when limiter env is configured.
- Production fee-bump requests fail closed when durable limiter env is missing.
- Server-only `SPONSOR_SECRET` is not exposed through frontend env vars.
- `/api/health` reports sponsor rate-limit readiness without exposing secret or token values.
- GitHub Actions includes a high-confidence secret-pattern scan and CodeQL semantic analysis workflow.
- Vercel headers include CSP, frame denial, content-type sniffing protection, referrer policy, and restricted browser permissions.
- Sentry is disabled unless `VITE_SENTRY_DSN` is configured.
- Soroban tests cover important negative authorization paths for vendor application, stats mutation, utang creation, repayment, and defaulting.

## Known Risks

- Local fee-bump fallback rate limiting is in-memory and not durable across instances; do not use it for production sponsorship.
- Testnet resets can invalidate contract IDs, account balances, sponsor balances, and proof links.
- Mainnet deployment still requires contract audit, live Vercel env proof, and operational runbook proof.
- Live payment end-to-end claims require wallet signing and verified Testnet transaction hashes.

## Secret Handling

- Do not commit `.env.local`, seed output, sponsor secrets, wallet private keys, or deployment tokens.
- Rotate any secret that appears in a public commit, screenshot, log, issue, or chat.
- Keep `SPONSOR_SECRET` and deployment credentials in Vercel environment variables or another secret manager.
- Use `frontend/.env.example` for non-secret examples only.

## Pre-Release Security Checklist

Run before claiming a release is production-ready:

- `cd frontend; npm test`
- `cd frontend; npx tsc --noEmit`
- `cd frontend; npm run lint`
- `cd frontend; npm run build`
- `cd frontend; npm run qa:visual`
- `cd contracts; cargo test --workspace`
- Check `/api/health` on the deployed URL.
- Smoke-test a wallet-signed Testnet payment.
- Confirm Vercel has server-only fee-bump env vars configured.
- Confirm durable Redis REST limiter env is configured and `/api/health` reports `sponsor_rate_limit` as healthy.
- Confirm GitHub `Security Scans` workflow is green or reviewed.
- Confirm no raw secrets appear in frontend bundles, logs, screenshots, docs, or repository history.
