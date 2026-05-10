
# PalengkePay — Black Belt Roadmap

## Requirements Checklist

- [ ] 30+ verified active users
- [ ] Metrics dashboard live
- [ ] Security checklist completed
- [ ] Monitoring active
- [ ] Data indexing implemented
- [ ] Full documentation
- [ ] 1 community contribution
- [x] 1 advanced feature implemented — Fee Sponsorship (gasless)
- [ ] 15+ meaningful commits
- [ ] Production-ready application

---

## Build Status

| Feature | Status | Committed |
|---------|--------|-----------|
| Fee Sponsorship (gasless) | ✅ Built | ⏳ Pending |
| Metrics Dashboard | ⬜ Not started | — |
| Data Indexing | ⬜ Not started | — |
| Monitoring (Sentry + health) | ⬜ Not started | — |
| Security (CSP + sanitizer) | ⬜ Not started | — |
| Full Documentation | ⬜ Not started | — |
| Friendbot faucet button | ⬜ Not started | — |
| CONTRIBUTING.md | ⬜ Not started | — |

---

## Advanced Feature (pick 1)

- [ ] **Fee Sponsorship** — Gasless transactions via fee bump ⭐ _recommended_
- [ ] Cross-border Flows — SEP-24/SEP-31 anchor integration
- [ ] Multi-signature Logic — Multi-party approval for transactions
- [ ] Account Abstraction — Smart wallet with custom auth

---

## Feature Breakdown

### 1. Fee Sponsorship — Gasless Transactions ✅ BUILT (not committed)
**Why:** Vendors/customers pay zero fees. Removes #1 adoption blocker.

- [x] `frontend/api/fee-bump.ts` — Vercel fn wraps inner tx with FeeBumpTransaction
- [x] `submitWithFeeBump()` in `frontend/src/lib/stellar.ts`
- [x] `frontend/src/lib/contracts.ts` — routes payments through fee-bump
- [x] `frontend/src/lib/hooks/usePayment.ts` — uses fee-bump
- [x] `frontend/vercel.json` — rewrite excludes `/api/*`
- [x] `frontend/.env.example` — documents `VITE_FEE_BUMP_URL`
- [ ] Add "Gasless ⚡" badge to UI (CustomerScan + PaymentForm)

> ⚠️ **BEFORE COMMITTING:** Add `SPONSOR_SECRET=<funded_testnet_secret>` to Vercel dashboard → Environment Variables. Never commit this key.

### 2. Metrics Dashboard
- [ ] New page `frontend/src/pages/admin/AdminMetrics.tsx`
- [ ] New hook `frontend/src/lib/hooks/useMetrics.ts`
- [ ] Live stats: active vendors, tx count, total XLM volume, avg tx size
- [ ] Weekly volume chart (recharts)
- [ ] Link from AdminMarket header

### 3. Data Indexing
- [ ] `frontend/src/lib/indexer.ts` — Horizon cursor-based indexer
- [ ] localStorage cache with last-cursor position
- [ ] VendorHome + CustomerHistory pull from index first
- [ ] Background sync on reconnect

### 4. Monitoring
- [ ] Add `@sentry/react` — init in `frontend/src/main.tsx`
- [ ] Capture failed Soroban calls + unhandled errors
- [ ] `api/health.ts` — checks Horizon + RPC liveness
- [ ] UptimeRobot free tier pinging deployed URL

### 5. Security Checklist
- [ ] CSP + security headers in `vercel.json`
- [ ] Input sanitizer util `frontend/src/lib/sanitize.ts`
- [ ] Audit Soroban contract admin auth
- [ ] `SECURITY.md` — checklist documented

### 6. Full Documentation
- [ ] `docs/ARCHITECTURE.md` — system diagram
- [ ] `docs/CONTRACTS.md` — all 3 contract interfaces + deployed IDs
- [ ] `docs/DEPLOYMENT.md` — step-by-step deploy guide
- [ ] `CONTRIBUTING.md` — good-first-issues, PR template
- [ ] README update — metrics screenshot, gasless callout

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
