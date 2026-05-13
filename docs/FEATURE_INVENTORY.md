# PalengkePay Feature Inventory

Last updated: 2026-05-13

This document is the working list of what has already been built, what is present in the app today, and what should come next. It is based on the current repo state, README, roadmap, frontend routes/hooks, API functions, Soroban contract modules, and the workspace deep-research reports in `../../docs/`.

## 0. Product Summary

PalengkePay is a Stellar Testnet web app for public-market vendors and customers. The app supports wallet onboarding, QR payments, vendor registration, customer/vendor transaction history, utang installment agreements, admin vendor management, gasless payment sponsorship, metrics, and operational health checks.

## 1. Previous Work Completed

### 1.1 Wallet, Onboarding, and Testnet Setup

- Built wallet connection through `@creit.tech/stellar-wallets-kit`.
- Added desktop wallet support and mobile WalletConnect support.
- Added `/connect` and `/onboard` flows.
- Added testnet funding guidance and Friendbot faucet support in the onboarding path.
- Added role-based entry points for vendor, customer, and admin flows.

Evidence:

- `frontend/src/components/WalletProvider.tsx`
- `frontend/src/pages/Connect.tsx`
- `frontend/src/pages/Onboard.tsx`
- `frontend/src/App.tsx`

### 1.2 Customer Payment Flow

- Built customer home, scan, history, and utang pages.
- Added QR scan and manual vendor wallet entry.
- Added vendor identity metadata in payment QR payloads.
- Added signed Stellar payment transaction flow.
- Routed live QR payments through the `PalengkePayment.pay` contract path when configured.
- Added instant local history with background Horizon sync.

Current caveat:

- Live QR payments now prefer `PalengkePayment.pay` when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured. Direct fee-bumped Stellar transfers remain as the missing-contract fallback.

Evidence:

- `frontend/src/pages/customer/CustomerHome.tsx`
- `frontend/src/pages/customer/CustomerScan.tsx`
- `frontend/src/pages/customer/CustomerHistory.tsx`
- `frontend/src/lib/hooks/usePayment.ts`
- `frontend/src/lib/hooks/useTransactions.ts`
- `frontend/src/lib/indexer.ts`
- `frontend/src/lib/stellar.ts`

### 1.3 Vendor Experience

- Built vendor home, QR, transaction history, utang, profile, and application pages.
- Added QR generation for payment requests.
- Added vendor profile display and status handling.
- Added vendor transaction history from Horizon/indexed cache.
- Added vendor utang creation surface with QR/manual acceptance paths.

Evidence:

- `frontend/src/pages/vendor/VendorHome.tsx`
- `frontend/src/pages/vendor/VendorQR.tsx`
- `frontend/src/pages/vendor/VendorTransactions.tsx`
- `frontend/src/pages/vendor/VendorUtang.tsx`
- `frontend/src/pages/vendor/VendorProfile.tsx`
- `frontend/src/pages/vendor/VendorApply.tsx`

### 1.4 Vendor Registry Contract and Admin Vendor Management

- Built `VendorRegistry` Soroban contract.
- Added vendor application flow.
- Added admin approve/reject flow.
- Added admin direct registration.
- Added vendor profile update.
- Added vendor deactivation.
- Added vendor stats counters for transaction count and volume.
- Patched auth so vendor application requires applicant wallet auth.
- Patched stats mutation so only the configured admin can increment stats.
- Added negative tests for unauthorized vendor application and stats mutation paths.

Current caveat:

- Vendor stats are currently admin-controlled counters. The cleaner future design is to update stats from the canonical payment contract path.

Evidence:

- `contracts/vendor-registry/src/lib.rs`
- `contracts/vendor-registry/src/test.rs`
- `frontend/src/pages/admin/AdminMarket.tsx`
- `frontend/src/pages/admin/AdminRegister.tsx`
- `frontend/src/lib/hooks/useVendor.ts`

### 1.5 Admin Metrics Dashboard

- Built admin metrics page at `/admin/metrics`.
- Added metrics hook.
- Added active vendor count, pending vendor count, total transaction count, total XLM volume, average transaction size, product breakdown, and top vendors.
- Linked metrics from admin market workflow.

Current caveat:

- Metrics still read `VendorRegistry` counters. The payment path has moved toward `PalengkePayment.pay`, but metrics still need to read the canonical payment source.

Evidence:

- `frontend/src/pages/admin/AdminMetrics.tsx`
- `frontend/src/lib/hooks/useMetrics.ts`
- `frontend/src/pages/admin/AdminMarket.tsx`

### 1.6 Utang / Installment Credit

- Built `UtangEscrow` Soroban contract.
- Added customer/vendor utang lists.
- Added create agreement flow.
- Added installment repayment flow.
- Added completed/defaulted status handling.
- Added customer-side acceptance from QR/uploaded offer data.
- Added vendor-side utang offer generation.
- Patched auth so utang creation and repayment require the customer signature.
- Patched defaulting so only admin can mark an agreement defaulted.
- Added Rust negative tests for wrong customer repayment, missing admin auth, and non-admin default attempts.

Current caveat:

- The current flow is closer to a customer-authorized creation model. The future target should be a true on-chain vendor-offer/customer-accept model.

Evidence:

- `contracts/utang-escrow/src/lib.rs`
- `contracts/utang-escrow/src/test.rs`
- `frontend/src/pages/vendor/VendorUtang.tsx`
- `frontend/src/pages/customer/CustomerUtang.tsx`
- `frontend/src/lib/hooks/useUtang.ts`

### 1.7 PalengkePayment Contract

- Built `PalengkePayment` Soroban contract.
- Added payment record storage.
- Added vendor payment lookup.
- Added payment-completed events.
- Added Rust tests for payment recording and retrieval.

Current caveat:

- This contract is now the preferred frontend QR payment execution path when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured.

Evidence:

- `contracts/palengke-payment/src/lib.rs`
- `contracts/palengke-payment/src/test.rs`
- `README.md`
- `ROADMAP.md`

### 1.8 Fee Sponsorship / Gasless Transactions

- Built Vercel API function for fee-bump sponsorship.
- Added client submit path through `submitWithFeeBump()` for the missing-contract fallback.
- Added gasless payment integration in the payment hook.
- Added Vercel routing so `/api/*` reaches serverless functions.
- Added fee-bump environment configuration documentation.
- Hardened fee-bump validation:
  - signed inner transaction required
  - Stellar Testnet network passphrase required
  - `PP:` memo required
  - only native XLM `payment` and `createAccount` operations sponsored
  - operation count limited
  - fee and amount bounded
  - source account signature required
  - optional destination allowlist via `FEE_BUMP_ALLOWED_DESTINATIONS`
  - in-memory per-IP rate limiting
- Added Vitest coverage for valid paths and abuse paths.

Current caveat:

- Serverless in-memory rate limits are best-effort only. Production should use durable rate limiting, firewall rules, or another shared limiter.

Evidence:

- `frontend/api/fee-bump.ts`
- `frontend/api/fee-bump.test.ts`
- `frontend/src/lib/stellar.ts`
- `frontend/src/lib/hooks/usePayment.ts`
- `frontend/vercel.json`
- `frontend/.env.example`

### 1.9 Data Indexing and Transaction History

- Added Horizon cursor-based payment indexer.
- Added localStorage cache.
- Added last-cursor tracking.
- Added vendor/customer history reads from cache with background sync.

Current caveat:

- Horizon/localStorage is a UX cache and history layer, not the business source of truth.

Evidence:

- `frontend/src/lib/indexer.ts`
- `frontend/src/lib/hooks/useTransactions.ts`

### 1.10 Monitoring, Health, and Security Hardening

- Added Sentry integration.
- Kept Sentry disabled when `VITE_SENTRY_DSN` is unset.
- Added health endpoint for Horizon and Soroban RPC liveness.
- Added CSP/security headers in Vercel config.
- Added input sanitizer utility.
- Added fee-bump abuse-path tests.
- Added contract auth negative tests.

Evidence:

- `frontend/src/main.tsx`
- `frontend/api/health.ts`
- `frontend/vercel.json`
- `frontend/src/lib/sanitize.ts`
- `frontend/api/fee-bump.test.ts`
- `contracts/vendor-registry/src/test.rs`
- `contracts/utang-escrow/src/test.rs`

### 1.11 Mobile and Responsive Surfaces

- Built mobile-friendly customer and vendor surfaces.
- Added mobile screenshots and usage guidance in README.
- Added WalletConnect mobile connection guidance.
- Added Playwright visual route checks across desktop and mobile viewports.
- Added PWA install guidance and Workbox/Vite PWA support.

Evidence:

- `README.md`
- `frontend/src/__tests__/visual-routes.spec.ts`
- `frontend/playwright.config.ts`
- `frontend/vite.config.ts`
- `frontend/src/pwa.ts`

### 1.12 Documentation and Proof Assets

- Added README feature documentation, screenshots, contract IDs, flow guides, environment notes, and proof sections.
- Added roadmap status and checklist.
- Added contracts README with deployment/testnet contract proof.
- Added this feature inventory as a standalone complete present/future list.

Evidence:

- `README.md`
- `ROADMAP.md`
- `contracts/README.md`
- `docs/FEATURE_INVENTORY.md`

### 1.13 Public, Market, and Shared App Surfaces

- Built landing page and public product walkthrough surface.
- Added market directory route for customer/vendor discovery.
- Added generic dashboard route and test-send route for internal/demo transaction checks.
- Added reusable wallet button, balance display, layout shell, toast system, transaction status tracker, QR generator, QR scanner, payment form, and utang card components.
- Added QR image upload, QR download, and payment/utang status UI through shared components and page flows.

Evidence:

- `frontend/src/pages/Landing.tsx`
- `frontend/src/pages/MarketDirectory.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/TestSend.tsx`
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/WalletButton.tsx`
- `frontend/src/components/BalanceDisplay.tsx`
- `frontend/src/components/Toast.tsx`
- `frontend/src/components/TxStatusTracker.tsx`
- `frontend/src/components/PaymentForm.tsx`
- `frontend/src/components/QRGenerator.tsx`
- `frontend/src/components/QRScanner.tsx`
- `frontend/src/components/UtangCard.tsx`

## 2. Present Feature Set

### 2.1 User Roles

| Role | Present capabilities |
| --- | --- |
| Customer | Connect wallet, fund testnet wallet, scan/pay vendor QR, manual pay, view history, accept/pay utang |
| Vendor | Apply, view vendor dashboard, generate payment QR, view transaction history, manage profile, create utang offers |
| Admin | Approve/reject vendors, direct-register vendors, deactivate vendors, view market dashboard, view metrics |

### 2.2 Frontend Routes

| Area | Routes |
| --- | --- |
| Public/onboarding | `/`, `/connect`, `/onboard`, `/market` |
| General/demo | `/dashboard`, `/test-send` |
| Customer | `/customer/home`, `/customer/scan`, `/customer/history`, `/customer/utang` |
| Vendor | `/vendor/home`, `/vendor/qr`, `/vendor/transactions`, `/vendor/utang`, `/vendor/profile`, `/vendor/apply` |
| Admin | `/admin/market`, `/admin/register`, `/admin/metrics` |

### 2.3 Contracts

| Contract | Present role | Current limitation |
| --- | --- | --- |
| `VendorRegistry` | Vendor applications, admin approvals, vendor profiles, vendor counters | Stats should eventually be updated by canonical payment flow |
| `PalengkePayment` | Payment records, vendor payment lookups, payment events, preferred QR payment execution | Metrics are not yet sourced from payment contract records |
| `UtangEscrow` | Utang agreements, repayment tracking, completion/default status | Needs true vendor-offer/customer-accept architecture |

### 2.4 API and Runtime Functions

| API | Present behavior |
| --- | --- |
| `frontend/api/fee-bump.ts` | Sponsors approved Stellar Testnet payment/createAccount transactions with fee bump |
| `frontend/api/health.ts` | Checks Horizon and Soroban RPC liveness |

### 2.5 Verification Commands

| Command | Purpose | Last known status |
| --- | --- | --- |
| `cd frontend; npm test -- api/fee-bump.test.ts` | Fee-bump validation and abuse-path tests | Passing: 10 tests |
| `cd frontend; npx tsc --noEmit` | TypeScript verification | Passing |
| `cd frontend; npm run lint` | Frontend lint | Passing |
| `cd frontend; npm run build` | Production build | Passing with Vite chunk-size warning |
| `cd frontend; npm run qa:visual` | Playwright desktop/mobile route checks | Passing: 16 tests |
| `cd contracts; cargo test --workspace` | Rust contract test suite | Passing: 32 tests |

## 3. Future Work

### 3.1 Highest Priority

1. Move payment events and vendor stats to the same source-of-truth transaction path.
2. Keep Horizon indexing as a cache/history layer only.
3. Replace admin-only `increment_stats` with an authorized payment-contract path.
4. Keep `cargo test --workspace` green in CI and local release checks.

### 3.2 Product Architecture

- Finish contract-first payment architecture by moving metrics and stats away from separate vendor counters.
- Redesign utang as vendor creates offer on-chain, customer accepts on-chain, and repayment follows that agreement.
- Add a clearer data model for payment, vendor stats, and indexed history boundaries.
- Add a dedicated architecture doc after canonical payment flow is chosen.

### 3.3 Security and Abuse Controls

- Add durable fee-bump rate limiting for production.
- Add `SECURITY.md`.
- Document threat model and sponsorship abuse limits.
- Review deployed contract admin/key rotation workflow.
- Audit all env var requirements before production deploy.

### 3.4 Deployment and Operations

- Keep `docs/DEPLOYMENT.md` current as env vars, contract IDs, and deployment flow change.
- Keep the production deployment checklist current.
- Add uptime monitor for deployed `/api/health`.
- Verify Vercel env values without exposing secrets.
- Add release checklist for contract IDs, RPC URLs, fee-bump sponsor account, and Sentry DSN.

### 3.5 Community and Submission Readiness

- Add `CONTRIBUTING.md`.
- Add issue templates and good-first-issue labels.
- Collect and document 30+ verified active users.
- Document at least one community contribution.
- Refresh screenshots after final flow changes.
- Record final demo proof after production/live deployment.

### 3.6 Nice-to-Have Polish

- Add vendor search/filter improvements in market directory.
- Add clearer customer payment receipt view.
- Add exportable admin metrics.
- Add richer error messages for wallet rejection and insufficient funds.
- Split large frontend chunks if bundle size becomes a production concern.

## 4. Deep-Research Recommendations

These items come from the workspace deep-research reports:

- `../../docs/deep-research-report-01.md`
- `../../docs/deep-research-report-02.md`
- `../../docs/deep-research-report-03.md`
- `../../docs/deep-research-report-04.md`

### 4.1 Judge-Facing Product Thesis

- Do not spend hackathon time on generic inventory, AI chat, or another landing-page pass.
- Keep the story tight: PalengkePay turns payment and repayment history into trust, and trust into merchant growth.
- Demo as a chain, not a feature tour:
  1. vendor receives a simple local-currency payment,
  2. customer accepts or repays utang,
  3. admin/lender sees a trust or credit passport,
  4. monetization is explained as monthly merchant software.

### 4.2 Recommended Feature Portfolio

| Priority | Feature | Why it matters | Research estimate |
| --- | --- | --- | --- |
| 1 | Stable Checkout with Price Lock and Dual-Currency Receipt | Makes crypto payments understandable to non-crypto users by centering PHP price, locked quote, and receipt proof | 16-22h |
| 2 | PalengkeScore Credit Passport | Converts payment and repayment history into a financeable vendor trust profile | 20-28h |
| 3 | Smart Collections for Utang | Adds reminders, partial pay, early settlement, and repayment receipts to the existing utang flow | 14-20h |
| 4 | Receipt Pack, CSV Export, Print-Ready QR Kit | Low-risk proof/polish that helps vendors, judges, and demos | 8-12h |
| 5 | Collections and Risk Dashboard for Market Admins | Turns admin metrics into a platform workflow around delinquency and risk | 12-18h |
| 6 | Family Basket / Remittance Sponsor | Stretch feature: remote family/sponsor prepays grocery budget for approved redemption | 24-36h |

### 4.3 Architecture Recommendations

- Unify payment event truth before building analytics, PalengkeScore, or risk dashboards.
- Prefer contract-first payments: route QR payments through `PalengkePayment.pay`, then make events and stats come from that path.
- Treat Horizon/localStorage as history/cache, not the business source of truth.
- Add a shared event/metrics model before expanding score, collections, or admin reporting.
- Replace admin-only `increment_stats` with an authorized payment-contract or event-normalizer path.
- Make QR payloads stronger over time: signed invoices, reusable checkout requests, basket budgets, and receipts instead of plain address metadata only.

### 4.4 Security, Abuse, and CI Recommendations

- Keep the fee-bump sponsorship flow; it is a real adoption advantage.
- Continue hardening fee-bump sponsorship with abuse-path tests and allowlists.
- Add or keep these regression tests in the backlog:
  - sponsor rejects non-payment XDR,
  - sponsor rejects unknown vendor destination,
  - vendor offer creation requires vendor auth,
  - customer acceptance requires customer auth,
  - stats mutation rejects unauthorized callers,
  - default marking is only allowed under valid overdue/admin conditions,
  - real payment updates metrics once,
  - manual wallet/address validation uses SDK checks,
  - CSP does not allow unsafe runtime behavior.
- Expand CI toward lint, TypeScript, Vitest coverage, production build, Rust fmt/clippy/test, CodeQL, and dependency scanning.
- Run a dynamic abuse review with malformed inner transactions and testnet wallets.
- Audit dependency and lockfile risk for frontend and Rust workspaces.
- Verify testnet reset resilience by redeploying contracts/accounts from a clean reset scenario.

### 4.5 Mobile Strategy Recommendations

- Do not treat mobile as just another frontend; verify backend readiness first.
- If building a durable mobile app, default to React Native plus Expo/native modules because the current team and app are TypeScript/React-heavy.
- Use Capacitor only for a quick web-first shell, not as the default long-term mobile architecture.
- Plan a mobile architecture around local database/cache, repository/sync layer, typed API client, backend/BFF, push provider, analytics, crash reporting, and release telemetry.
- Make offline persistence, idempotent mutations, background sync, secure storage, privacy disclosures, and app-store policy part of the first planning pass.
- Treat the deep-research mobile estimate as a separate product track: roughly 20-28 weeks for a serious medium-complexity mobile rollout with mobile, backend, design, QA, and release ownership.

### 4.6 Monetization Recommendations

- Do not price PalengkePay as SGD 8-10 per transaction.
- Use monthly merchant software pricing instead:
  - Growth: SGD 8/user/month for stable checkout, receipts, QR kit, CSV export, reminders, and partial-pay support.
  - Pro: SGD 10/user/month for PalengkeScore, reports, collections dashboard, Family Basket sponsor flow, and advanced analytics.
- Position the wedge around time saved, better records, collections, and credit readiness.
- Treat 1,000 paying vendors as a hackathon-realistic first commercial milestone, not a massive first-year adoption claim.

### 4.7 Research Open Questions

- Are deployed contract IDs and WASM hashes aligned with this source tree?
- Should fee sponsorship expand to tightly validated Soroban payment invocations, or remain only as the classic-transfer fallback?
- Are vendor/admin/customer forms consistently validating wallet addresses, amounts, memo fields, and uploaded QR payloads?
- What is the chosen mobile target: web PWA only, quick mobile shell, or durable store-ready mobile app?
- Which features are actually needed for the next submission: judge demo, production pilot, or mobile expansion?

## 5. Open Blockers

- Production fee sponsorship needs real server-side env values:
  - `SPONSOR_SECRET`
  - `FEE_BUMP_ALLOWED_DESTINATIONS`
  - optional rate/limit tuning variables
- Mainnet launch should wait until contract architecture is finalized and audited.
