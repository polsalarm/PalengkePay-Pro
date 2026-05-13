
# PalengkePay — Black Belt Roadmap

## Requirements Checklist

- [ ] 30+ verified active users
- [x] Metrics dashboard live
- [x] Security checklist partially completed
- [x] Monitoring active
- [x] Data indexing implemented
- [x] README documentation refreshed
- [x] Comprehensive docs pack documented
- [x] Contract-first QR payment path
- [ ] 1 community contribution
- [x] 1 advanced feature implemented — Fee Sponsorship (gasless)
- [ ] 15+ meaningful commits
- [ ] Production-ready application

---

## Build Status

| Feature | Status | Committed |
|---------|--------|-----------|
| Fee Sponsorship (gasless) | ✅ Built + abuse-path tests | ✅ Checkpointed |
| Metrics Dashboard | ✅ Built | ✅ Checkpointed |
| Data Indexing | ✅ Built | ✅ Checkpointed |
| Monitoring (Sentry + health) | ✅ Built | ✅ Checkpointed |
| Security (CSP + sanitizer + contract auth) | 🟡 Partial | ✅ Checkpointed |
| Contract-first QR Payments | ✅ Built | ⏳ Pending |
| Full Documentation | ✅ README + feature inventory + user flows + architecture + contracts + deployment + verification docs refreshed | ✅ Checkpointed |
| Friendbot faucet button | ✅ Built on `/connect` and onboarding | ✅ Checkpointed |
| CONTRIBUTING.md | ⬜ Not started | — |

---

## Advanced Feature (pick 1)

- [x] **Fee Sponsorship** — Gasless transactions via fee bump ⭐ _recommended_
- [ ] Cross-border Flows — SEP-24/SEP-31 anchor integration
- [ ] Multi-signature Logic — Multi-party approval for transactions
- [ ] Account Abstraction — Smart wallet with custom auth

---

## Feature Breakdown

### 1. Fee Sponsorship — Gasless Transactions ✅ BUILT + HARDENED
**Why:** Vendors/customers pay zero fees. Removes #1 adoption blocker.

- [x] `frontend/api/fee-bump.ts` — Vercel fn wraps inner tx with FeeBumpTransaction
- [x] `submitWithFeeBump()` in `frontend/src/lib/stellar.ts`
- [x] `frontend/src/lib/contracts.ts` — routes payments through fee-bump
- [x] `frontend/src/lib/hooks/usePayment.ts` — uses fee-bump
- [x] `frontend/vercel.json` — rewrite excludes `/api/*`
- [x] `frontend/.env.example` — documents `VITE_FEE_BUMP_URL`
- [x] `frontend/api/fee-bump.test.ts` — validates signed source, `PP:` memo, operation type, amount/fee limits, destination allowlist, and rate limiting
- [x] Add settlement badge to UI (contract receipt or gasless fallback)

> ⚠️ **BEFORE DEPLOYING:** Add `SPONSOR_SECRET=<funded_testnet_secret>` and `FEE_BUMP_ALLOWED_DESTINATIONS=<comma-separated approved destinations>` to Vercel dashboard → Environment Variables. Never commit these keys.

### 2. Metrics Dashboard
- [x] New page `frontend/src/pages/admin/AdminMetrics.tsx`
- [x] New hook `frontend/src/lib/hooks/useMetrics.ts`
- [x] Stats: active vendors, tx count, total XLM volume, avg tx size
- [x] Product breakdown + top vendors
- [x] Link from AdminMarket header
- [x] QR payments prefer `PalengkePayment.pay`
- [x] Metrics prefer `PalengkePayment` records through `frontend/src/lib/payment-source.ts`
- [x] Dashboard labels when it falls back to legacy registry counters
- [ ] Deferred: redeploy payment contract with customer payment lookup and retire registry stat fallback

### 3. Data Indexing
- [x] `frontend/src/lib/indexer.ts` — Horizon cursor-based indexer
- [x] localStorage cache with last-cursor position
- [x] Vendor/customer history merge `PalengkePayment` records with Horizon cache fallback
- [x] Background sync pattern

### 4. Monitoring
- [x] Add `@sentry/react` — init in `frontend/src/main.tsx`
- [x] Sentry is disabled when `VITE_SENTRY_DSN` is unset
- [x] `api/health.ts` — checks Horizon + RPC liveness
- [ ] UptimeRobot free tier pinging deployed URL

### 5. Security Checklist
- [x] CSP + security headers in `vercel.json`
- [x] Input sanitizer util `frontend/src/lib/sanitize.ts`
- [x] Fee-bump XDR policy checks + abuse-path tests
- [x] Vendor apply requires wallet auth
- [x] Vendor stats mutation requires admin auth
- [x] Utang creation requires customer auth
- [x] Utang repayment/default negative tests added
- [ ] Next: migrate utang to a true on-chain vendor-offer/customer-accept model
- [ ] Next: replace admin-only `increment_stats` with an authorized payment-contract path
- [ ] `SECURITY.md` — checklist documented

### 6. Full Documentation
- [x] `docs/FEATURE_INVENTORY.md` — previous work, present features, future work, and blockers
- [x] `docs/USER_FLOWS.md` — end-to-end customer, vendor, admin, onboarding, and demo flows
- [x] `docs/ARCHITECTURE.md` — runtime layers, source-of-truth map, and target architecture
- [x] `docs/CONTRACTS.md` — all 3 contract interfaces, auth boundaries, frontend usage, and deployed IDs
- [x] `docs/DEPLOYMENT.md` — step-by-step local/deploy guide, env vars, smoke checks, and reset recovery
- [x] `docs/VERIFICATION.md` — command gates and claim rules
- [ ] `CONTRIBUTING.md` — good-first-issues, PR template
- [x] README project-doc links refreshed

### 7. User Acquisition (30+ verified)
- [ ] Add Friendbot faucet button on `/connect` page
- [ ] Share onboard link in Stellar Discord `#showcase`
- [ ] Share in Filipino dev communities
- [ ] Add each verified wallet to README table

### 8. Community Contribution
- [ ] Create 3 `good first issue` labels on GitHub
- [ ] `CONTRIBUTING.md` with setup guide
- [ ] Get 1 PR merged from external contributor

---

## Payment / Metrics Architecture Decision

Current state:

- Live QR payments prefer `PalengkePayment.pay` when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured.
- Stable Checkout now uses a PHP-first one-minute price lock and dual-currency receipt before Stellar XLM settlement.
- Transaction history prefers `PalengkePayment` records and keeps the Horizon indexer/localStorage cache as fallback.
- Admin metrics prefer `PalengkePayment` records and fall back to counters in `VendorRegistry` when payment contract reads are unavailable.
- Direct Stellar transfers through `submitWithFeeBump()` remain as the missing-contract fallback.

Recommended next architecture:

- Deferred for now: redeploy `PalengkePayment` with `get_customer_payments` so customer history has the same contract read path as vendor history.
- Retire or further restrict `VendorRegistry.increment_stats` after registry fallback is no longer needed.
- Keep Horizon indexing only as a fast read/cache layer for user history.

Decision remaining: choose whether vendor stats should live only in `PalengkePayment` reads or be copied into `VendorRegistry` through an authorized event bridge.

---

## Commit Target: 15+

| # | Commit |
|---|--------|
| 1 | `feat(api): add fee-bump sponsorship edge function` |
| 2 | `feat(stellar): add buildFeeBumpXdr and gasless payment support` |
| 3 | `feat(payment): route payments through fee-bump server` |
| 4 | `feat(connect): add Friendbot testnet faucet button` |
| 5 | `feat(metrics): add AdminMetrics page with live Horizon stats` |
| 6 | `feat(metrics): add weekly volume chart` |
| 7 | `feat(indexer): add cursor-based Horizon payment indexer` |
| 8 | `feat(indexer): integrate indexer into VendorHome and CustomerHistory` |
| 9 | `feat(monitoring): add Sentry error tracking` |
| 10 | `feat(api): add /health endpoint` |
| 11 | `feat(security): add CSP headers in vercel.json` |
| 12 | `feat(security): add input sanitization util` |
| 13 | `docs: add ARCHITECTURE, CONTRACTS, DEPLOYMENT` |
| 14 | `docs: add CONTRIBUTING and issue templates` |
| 15 | `docs: update README with metrics and gasless callout` |

---

## 12-Hour Sprint Schedule

| Time | Task |
|------|------|
| 0–1h | Fee Sponsorship — edge fn + stellar.ts + payment hook |
| 1–2h | Friendbot button + share links NOW (user acquisition starts) |
| 2–3h | Data Indexer |
| 3–4h | Metrics Dashboard |
| 4–5h | Monitoring — Sentry + /health |
| 5–6h | Security — CSP + sanitizer + SECURITY.md |
| 6–8h | Full Documentation |
| 8–10h | User acquisition grind — verify 30+ wallets |
| 10–11h | Community contribution — open issues, get 1 PR |
| 11–12h | Final commit audit, deploy, screenshot metrics |
