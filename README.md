# PalengkePay

> Stellar-powered micropayment PWA for Philippine wet market vendors. No bank account required.

![Stellar](https://img.shields.io/badge/Stellar-Testnet-00B4D8?style=flat&logo=stellar&logoColor=white)
![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-008055?style=flat)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.80+-DEA584?style=flat&logo=rust&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat&logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat)

---

## 🔗 Live Demo

**[palengke-pay.vercel.app](https://palengke-pay.vercel.app)**

## 🎥 Demo Video

**[▶ Introduction — PalengkePay in 60 seconds](https://www.youtube.com/shorts/WmEz41GHeng?feature=share)**

[![PalengkePay Introduction](https://img.youtube.com/vi/WmEz41GHeng/0.jpg)](https://www.youtube.com/shorts/WmEz41GHeng?feature=share)

**⭐ Recommended — [Watch full MVP walkthrough on YouTube →](https://youtu.be/hOiuXBG5A3Q?si=lLhgmeAsGQVen8e1)**

[![PalengkePay Full MVP Walkthrough](https://img.youtube.com/vi/hOiuXBG5A3Q/0.jpg)](https://youtu.be/hOiuXBG5A3Q?si=lLhgmeAsGQVen8e1)

## 📊 User Feedback

Beta users were onboarded via a Google Form collecting name, email, wallet address, and product rating.

**[View Feedback Responses (Google Sheets) →](https://docs.google.com/spreadsheets/d/1g0AYRCwqc1-zcxy2q5UnIGHtllJHsXSaUvTCD7POI-g/edit?usp=sharing)**

## Project Docs

- **[Feature Inventory](docs/FEATURE_INVENTORY.md)** — complete previous work, present features, current caveats, and future work.
- **[User Flows](docs/USER_FLOWS.md)** — customer, vendor, admin, onboarding, utility, and demo flows.
- **[Architecture](docs/ARCHITECTURE.md)** — runtime layers, source-of-truth map, payment architecture, and target architecture.
- **[Contracts](docs/CONTRACTS.md)** — Soroban contract interfaces, auth boundaries, frontend usage, and contract roadmap.
- **[Deployment](docs/DEPLOYMENT.md)** — local setup, env vars, Vercel deployment, smoke checks, and reset recovery.
- **[Verification Gates](docs/VERIFICATION.md)** — commands and evidence required before claiming built, passing, deployed, or production-ready.
- **[Manual E2E Runbook](docs/MANUAL_E2E_RUNBOOK.md)** — wallet-backed payment, history, metrics, and utang proof steps.
- **[Dependency Audit Notes](docs/DEPENDENCY_AUDIT.md)** — npm audit remediation, overrides, and remaining transitive risk.
- **[Contributing](CONTRIBUTING.md)** — setup, quality gates, good first issue ideas, and PR checklist.
- **[Security](SECURITY.md)** — reporting scope, current controls, known risks, and pre-release checklist.
- **[Roadmap](ROADMAP.md)** — build status, requirements checklist, and next architecture decisions.
- **[Contracts Guide](contracts/README.md)** — deployed contract IDs, interfaces, and Soroban commands.

---

## Live Walkthrough

### Desktop — Web View

**Landing**

<img src="UI/WEB/landing/land1.png" alt="Landing — hero" width="100%" />

<img src="UI/WEB/landing/land2.png" alt="Landing — features" width="100%" />

<img src="UI/WEB/landing/land3.png" alt="Landing — how it works" width="100%" />

<img src="UI/WEB/landing/land4.png" alt="Landing — footer" width="100%" />

**Connect Wallet**

<img src="UI/WEB/onboard/connect1.png" alt="Connect wallet" width="100%" />

**Onboarding Flow**

| Get a Wallet | Connect | Fund | You're Ready |
|:---:|:---:|:---:|:---:|
| <img src="UI/WEB/onboard/onboard.png" alt="Step 1" width="220" /> | <img src="UI/WEB/onboard/onboard1.png" alt="Step 2" width="220" /> | <img src="UI/WEB/onboard/onboard2.png" alt="Step 3" width="220" /> | <img src="UI/WEB/onboard/onbaord3.png" alt="Step 4" width="220" /> |

**Vendor**

| Home | QR Code | Transactions | Utang | Profile | Apply |
|:---:|:---:|:---:|:---:|:---:|:---:|
| <img src="UI/WEB/vendor/home.png" alt="Vendor Home" width="160" /> | <img src="UI/WEB/vendor/qr.png" alt="QR" width="160" /> | <img src="UI/WEB/vendor/transactions.png" alt="Transactions" width="160" /> | <img src="UI/WEB/vendor/utang.png" alt="Utang" width="160" /> | <img src="UI/WEB/vendor/profile.png" alt="Profile" width="160" /> | <img src="UI/WEB/vendor/apply.png" alt="Apply" width="160" /> |

**Customer**

| Home | Scan & Pay | History | My Utang | Market Directory |
|:---:|:---:|:---:|:---:|:---:|
| <img src="UI/WEB/costumer/home.png" alt="Customer Home" width="180" /> | <img src="UI/WEB/costumer/scan.png" alt="Scan & Pay" width="180" /> | <img src="UI/WEB/costumer/history.png" alt="History" width="180" /> | <img src="UI/WEB/costumer/utang.png" alt="My Utang" width="180" /> | <img src="UI/WEB/costumer/market.png" alt="Market" width="180" /> |

**Admin**

| Market Dashboard | Pending Approvals | Active Vendors | Manual Register |
|:---:|:---:|:---:|:---:|
| <img src="UI/WEB/admin/market_dashboard.png" alt="Market Dashboard" width="220" /> | <img src="UI/WEB/admin/approve.png" alt="Approve Vendors" width="220" /> | <img src="UI/WEB/admin/current_vendors.png" alt="Current Vendors" width="220" /> | <img src="UI/WEB/admin/manual_register.png" alt="Manual Register" width="220" /> |

---

### Mobile

**Landing**

| | | | | |
|:---:|:---:|:---:|:---:|:---:|
| <img src="UI/MOBILE/landingpage/landm1.png" alt="Landing 1" width="160" /> | <img src="UI/MOBILE/landingpage/landm2.png" alt="Landing 2" width="160" /> | <img src="UI/MOBILE/landingpage/landm3.png" alt="Landing 3" width="160" /> | <img src="UI/MOBILE/landingpage/landm4.png" alt="Landing 4" width="160" /> | <img src="UI/MOBILE/landingpage/landm5.png" alt="Landing 5" width="160" /> |

**Customer**

| Home | Scan & Pay | History | My Utang | Market |
|:---:|:---:|:---:|:---:|:---:|
| <img src="UI/MOBILE/costumer/home.png" alt="Customer Home" width="160" /> | <img src="UI/MOBILE/costumer/scan.png" alt="Scan" width="160" /> | <img src="UI/MOBILE/costumer/history.png" alt="History" width="160" /> | <img src="UI/MOBILE/costumer/utang.png" alt="Utang" width="160" /> | <img src="UI/MOBILE/costumer/market.png" alt="Market" width="160" /> |

**Vendor**

| Home | QR Code | Utang | History | Profile |
|:---:|:---:|:---:|:---:|:---:|
| <img src="UI/MOBILE/vendor/home.png" alt="Vendor Home" width="160" /> | <img src="UI/MOBILE/vendor/qr.png" alt="QR" width="160" /> | <img src="UI/MOBILE/vendor/utang.png" alt="Utang" width="160" /> | <img src="UI/MOBILE/vendor/history.png" alt="History" width="160" /> | <img src="UI/MOBILE/vendor/profile.png" alt="Profile" width="160" /> |

---

## Problem

Philippine wet market vendors operate almost entirely in cash. This creates real friction:

- **No payment history** — disputes over what was paid, when, and how much
- **Manual utang tracking** — credit ("utang") managed on paper or memory, prone to loss and fraud
- **No digital trail** — vendors can't prove income for loans or government support
- **Exclusion from financial systems** — no bank account means no digital payments, no receipts, no records

Customers face matching problems: no receipt for purchases, no structured repayment for credit, no visibility into what they owe.

---

## Solution

PalengkePay puts a Stellar wallet in every vendor's pocket and a QR code on every stall. Payments settle on-chain in seconds. Credit agreements are recorded as smart contracts — tamper-proof, visible to both parties, and repaid installment by installment.

- Vendor generates a QR code → customer scans and pays
- Vendor offers installment credit (utang) → QR-based or manual → customer accepts on their phone
- Every transaction is on-chain: immutable, auditable, no middleman

---

## Advanced Features

### 💸 Stable Checkout with Price Lock
Customer checkout is now PHP-first. The app locks the current PHP/XLM quote for one minute, converts the payment into XLM for Stellar settlement, saves the signed proof locally, and shows a dual-currency receipt after confirmation.

- `frontend/src/lib/checkout-quote.ts` — builds the locked quote, expiry window, and receipt formatting
- `frontend/src/lib/payment-proof.ts` — persists the wallet-signed hash and quote for receipt/history recovery
- `frontend/api/quote.ts` — serves the PHP/XLM quote for production; the frontend keeps a direct CoinGecko fallback for local/dev
- `frontend/src/components/PaymentForm.tsx` — collects PHP amount, shows locked XLM, rate, and countdown
- `frontend/src/pages/customer/CustomerScan.tsx` — carries the quote through confirmation and receipt screens
- `frontend/src/pages/Receipt.tsx` — standalone `/receipt/:txHash` route for saved dual-currency proof

### ⚡ Gasless Transactions (Fee Sponsorship)
Fee sponsorship remains available as the fallback path for classic Stellar transfers when the payment contract is not configured. A server-side sponsor wallet wraps approved payment/createAccount inner transactions in a Stellar FeeBumpTransaction. Users sign the inner transaction; the sponsor covers the classic Stellar fee.

- `frontend/api/fee-bump.ts` — Vercel serverless function wraps inner XDR with FeeBumpTransaction
- `SPONSOR_SECRET` stays server-only; never shipped to the client
- Sponsorship is restricted to signed Stellar Testnet inner transactions with `PP:` PalengkePay memos, native XLM `payment` / `createAccount` operations only, approved destinations when `FEE_BUMP_ALLOWED_DESTINATIONS` is configured, bounded fees, bounded amounts, and matching source signatures
- The endpoint includes a best-effort in-memory per-IP rate limit. For production, pair it with durable storage, Vercel Firewall, or another edge/WAF limiter because serverless memory is not shared across instances.
- Current deployed QR payments prefer `PalengkePayment.pay` when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured, giving an on-chain contract receipt and shared payment source of truth.

### 📊 Metrics Dashboard
Admin metrics prefer `PalengkePayment` records — accessible at `/admin/metrics`.

- Total vendors, active vs. pending counts
- Total XLM volume, transaction count, average transaction size
- Product category breakdown (horizontal bars)
- Top 5 vendors by volume (progress bars)
- Compatibility fallback: if the payment contract ID is missing or contract reads fail, the dashboard can fall back to legacy `VendorRegistry` counters and shows that fallback state in the UI.

### 🗂 Data Indexing
Contract-first payment history with Horizon/localStorage fallback.

- `frontend/src/lib/payment-source.ts` — normalizes `PalengkePayment` records for history and metrics
- `frontend/src/lib/indexer.ts` — fetches since last cursor, merges into cache, returns newest-first
- Vendor and customer transaction views load cached Horizon rows immediately, then merge contract records when available
- Zero extra infrastructure — pure Horizon + browser storage

### 🔍 Monitoring
- Sentry error tracking initialized in `main.tsx` — disabled automatically if `VITE_SENTRY_DSN` is unset
- `frontend/api/health.ts` — `/api/health` endpoint checks Horizon + Soroban RPC liveness, returns `{status: 'ok'|'degraded'}`
- `/admin/health` shows the health payload and public client env readiness without exposing secrets

![Sentry Dashboard](assets/sentry-dashboard.png)

---

## Core Features

### Payments
- **QR-based payments** — vendor displays QR, customer scans and pays XLM in seconds
- **Stable checkout** — customer enters PHP, app locks a short-lived PHP/XLM quote, and receipt shows both PHP paid and XLM settled
- **Vendor identity in QR** — name and stall info embedded so customers see who they're paying before signing
- **Print-ready QR kit** — vendor QR route includes a poster and sticker print layout with versioned QR payload metadata
- **Memo field** — customer logs what they bought (e.g. "2kg tilapia") visible in transaction history
- **Real-time notifications** — vendor gets a browser push notification on payment received
- **Current source of truth** — live QR payments use `PalengkePayment.pay` when the contract ID is configured; direct fee-bumped Stellar transfers remain as the missing-contract fallback.

### BNPL / Utang (Credit)
- **QR offer flow** — vendor fills in items, amount, installments, interval → pays service fee → QR generated → customer scans to accept
- **Manual entry** — vendor types or scans a customer wallet to generate a customer-specific offer QR; the customer still signs acceptance from their own wallet
- **On-chain items description** — what the customer is buying on credit is stored in the smart contract
- **Customer acceptance** — customer scans vendor's utang QR, reviews all terms, signs and submits from their own wallet
- **Installment tracking** — progress bar per agreement, due dates, overdue flagging
- **QR image upload** — customer can upload a saved utang QR image from their gallery instead of scanning live
- **Download QR** — vendor can download the generated utang QR as a PNG for sharing

### Vendor Management
- **Self-service apply flow** — vendor submits stall info on-chain, no admin needed upfront
- **Admin approve/reject** — admin wallet reviews pending applications on-chain
- **Admin deactivate** — admin can deactivate an active vendor from the dashboard
- **Vendor profile** — name, stall number, product type, phone, transaction count, volume

### Admin Dashboard
- Pending applications tab with approve/reject inline
- Registered vendors tab with phone numbers and deactivate button
- Stats clickable as tab switchers
- Direct vendor registration (bypass apply flow)

### PWA
- Installable on mobile and desktop
- Offline-capable shell
- Branded icons and manifest

---

## Contracts

| Contract | Contract ID | Purpose |
|----------|-------------|---------|
| `VendorRegistry` | `CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH` | Vendor registration, apply/approve/reject/deactivate, profiles |
| `PalengkePayment` | `CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF` | QR-based payments with fee support and stat tracking |
| `UTangEscrow` | `CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG` | BNPL installment agreements — create, pay, complete, default |

All deployed on **Stellar Testnet**. See [`docs/CONTRACTS.md`](docs/CONTRACTS.md) for contract interfaces and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for deployment guidance.

> **Note:** Stellar Testnet resets periodically (~quarterly). Contract IDs above are from the April 2026 deployment. After a reset, follow `docs/DEPLOYMENT.md`, redeploy contracts, and update `.env.local` and this table.

### VendorRegistry

`CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH` · [View on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH)

<img src="UI/CONTRACT/VendorRegistry.png" alt="VendorRegistry contract on Stellar Expert" width="100%" />

### PalengkePayment

`CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF` · [View on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF)

<img src="UI/CONTRACT/PalengkeyPayment.png" alt="PalengkePayment contract on Stellar Expert" width="100%" />

### UTangEscrow

`CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG` · [View on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG)

<img src="UI/CONTRACT/UtangEscrow.png" alt="UTangEscrow contract on Stellar Expert" width="100%" />

---

## Contract Tests

Run all tests:

```bash
cd contracts
cargo test --workspace
```

### VendorRegistry — `contracts/vendor-registry/src/test.rs`

| Test | What it verifies |
|------|-----------------|
| `test_register_vendor` | Admin registers vendor; ID starts at 1; count increments |
| `test_get_vendor` | Registered vendor returns correct name, stall, product type, active=true |
| `test_apply_and_approve` | Vendor applies → pending count = 1 → admin approves → vendor count = 1 |
| `test_apply_vendor_requires_wallet_auth` | Vendor application requires the applicant wallet signature |
| `test_apply_and_reject` | Vendor applies → admin rejects → status = Rejected |
| `test_get_pending_vendors` | Two applicants → pagination returns both; approval removes one |
| `test_get_all_vendors` | Mix of direct-register + approved-application both appear in list |
| `test_duplicate_application_panics` | Second apply from same wallet panics `"application already pending"` |
| `test_update_profile` | Vendor updates own name/stall/phone/product; change persists |
| `test_duplicate_registration_panics` | Re-registering same wallet panics `"vendor already registered"` |
| `test_deactivate_vendor` | Admin deactivates vendor; `is_active` = false |
| `test_increment_stats` | Two payments accumulate correct `total_transactions` and `total_volume` |
| `test_increment_stats_requires_admin_auth` | Stats mutation rejects calls without admin auth |
| `test_non_admin_cannot_increment_stats` | Non-admin caller cannot mutate vendor stats |
| `test_non_admin_cannot_register` | Non-admin caller panics `"not admin"` |

### PalengkePayment — `contracts/palengke-payment/src/test.rs`

| Test | What it verifies |
|------|-----------------|
| `test_payment_count_starts_zero` | Fresh contract has `payment_count() == 0` |
| `test_pay_increments_count` | Two payments → count = 2 |
| `test_get_payment_returns_correct_data` | Payment record stores correct customer, vendor, amount |
| `test_get_vendor_payments` | Two payments to same vendor → paginated list returns both |
| `test_zero_amount_panics` | Zero-amount pay panics `"amount must be positive"` |

### UTangEscrow — `contracts/utang-escrow/src/test.rs`

| Test | What it verifies |
|------|-----------------|
| `test_utang_count_starts_zero` | Fresh contract has `utang_count() == 0` |
| `test_create_utang` | Creates agreement; verifies all fields (amount, installments, status=Active, description) |
| `test_create_utang_requires_customer_auth` | Third parties cannot create customer debt without customer signature |
| `test_pay_installment_transfers_and_tracks` | 3 installments → paid count tracks correctly → final status = Completed |
| `test_get_customer_utangs` | Customer with 2 agreements → list returns both |
| `test_get_vendor_utangs` | Vendor with 1 agreement → list returns it |
| `test_mark_default` | Admin marks active utang → status = Defaulted |
| `test_pay_completed_utang_panics` | Paying an already-completed utang panics `"utang not active"` |
| `test_zero_amount_panics` | Zero total_amount panics `"total_amount must be positive"` |

---

## App Flow

### Vendor
1. Go to `/connect` → connect Stellar wallet (Freighter or WalletConnect)
2. `/onboard` → fund testnet wallet → choose Vendor role → `/vendor/apply`
3. Admin approves at `/admin/market`
4. Vendor dashboard → generate QR for payments
5. Vendor Utang tab → create installment agreements via QR or manual entry

### Customer
1. Go to `/connect` → connect wallet
2. Scan vendor QR at `/customer/scan` → enter amount + memo → pay
3. View history at `/customer/history`
4. My Utang tab → scan / upload vendor's utang QR → accept plan → pay installments

### Admin
- `/admin/market` — review pending applications, approve/reject, deactivate vendors
- `/admin/register` — direct vendor registration
- `/admin/metrics` — payment-record metrics with registry fallback labels
- `/admin/health` — Horizon/RPC health and public env readiness

---

## Mobile Usage (Vendors & Customers)

PalengkePay is a PWA — open in your phone's browser, no app store needed.

### Step 1 — Install LOBSTR

- **Android:** [Play Store → LOBSTR](https://play.google.com/store/apps/details?id=com.lobstr.client)
- **iOS:** [App Store → LOBSTR](https://apps.apple.com/app/lobstr-stellar-wallet/id1357511383)

Create a wallet inside LOBSTR and **save your recovery phrase**.

### Step 2 — Get Testnet XLM

PalengkePay runs on Stellar Testnet. Get free testnet XLM via the in-app onboarding (Step 3 of the onboarding flow auto-funds your wallet), or manually via [Stellar Friendbot](https://friendbot.stellar.org/?addr=YOUR_ADDRESS).

### Step 3 — Connect on Mobile

1. Open PalengkePay in your phone's browser
2. Tap **Connect Wallet** → select **WalletConnect**
3. Tap **Open in LOBSTR** (deep link — no QR scan needed on mobile)
4. Approve the connection inside LOBSTR
5. Sign the confirmation prompt → done

### Install as PWA (Optional)

- **Android (Chrome):** Tap ⋮ → *Add to Home screen*
- **iOS (Safari):** Tap Share → *Add to Home Screen*

---

## Verified Testnet Users

The following wallets connected to the app and tested core functionality on Stellar Testnet. Each entry links to the wallet's full transaction history on Stellar Expert — transparent, on-chain proof of participation.

| # | Role | Wallet Address | Transaction History |
|---|------|----------------|---------------------|
| 1 | Customer | `GCAPIVKCRMCP7S3NMZTEHXTCVT32AYMLQTLJDQ62B7HPRERGPNVUTETB` | [View on Stellar Expert →](https://stellar.expert/explorer/testnet/account/GCAPIVKCRMCP7S3NMZTEHXTCVT32AYMLQTLJDQ62B7HPRERGPNVUTETB) |
| 2 | Customer | `GDRJD2K6XUOSLM5VMGSYHE52S7PMK5CC5VSIWHO2N7VPHJOLLREWASLM` | [View on Stellar Expert →](https://stellar.expert/explorer/testnet/account/GDRJD2K6XUOSLM5VMGSYHE52S7PMK5CC5VSIWHO2N7VPHJOLLREWASLM) |
| 3 | Customer | `GC4GDDXKK36P6YIU7GHGKLWPRTWFORV4FTSH6MDKCCAQKB6NIVRAIDBE` | [View on Stellar Expert →](https://stellar.expert/explorer/testnet/account/GC4GDDXKK36P6YIU7GHGKLWPRTWFORV4FTSH6MDKCCAQKB6NIVRAIDBE) |
| 4 | Vendor | `GCFFUUKXBQK4MCVDBIIKRWWPBP5DPYSQ6YY6LQSI3W5I4GSNQ267VV3B` | [View on Stellar Expert →](https://stellar.expert/explorer/testnet/account/GCFFUUKXBQK4MCVDBIIKRWWPBP5DPYSQ6YY6LQSI3W5I4GSNQ267VV3B) |
| 5 | Vendor | `GBVCJE6ZXKIROQ5GVRX4TLGC5U4MJNSZYK4BTBFRI6TIW3RD3KHUBOP4` | [View on Stellar Expert →](https://stellar.expert/explorer/testnet/account/GBVCJE6ZXKIROQ5GVRX4TLGC5U4MJNSZYK4BTBFRI6TIW3RD3KHUBOP4) |
| 6 | Vendor | `GBH4SBWR6WUWBGS2BYT7FNHJY7SVJ5M5ES7POPX6WKPNLSZD4D5Q2WZF` | [View on Stellar Expert →](https://stellar.expert/explorer/testnet/account/GBH4SBWR6WUWBGS2BYT7FNHJY7SVJ5M5ES7POPX6WKPNLSZD4D5Q2WZF) |

---

## Next Phase — Improvements Based on User Feedback

The following improvements are planned for Phase 2, derived directly from beta user feedback collected via the Google Form above.

### UI / UX
- **Peso (PHP) display alongside XLM** — users unfamiliar with XLM amounts requested a live PHP conversion using a public exchange rate API. Commit: [`1039c68`](https://github.com/polsalarm/PalengkePay/commit/1039c68) _(Phase 1 redesign laid the groundwork for the balance hero)_
- **Push notifications on mobile** — vendors reported missing payment alerts when the app is backgrounded. Will implement Web Push via service worker.
- **Vendor search / filter in market directory** — customers want to find vendors by product type or stall number faster.

### Features
- **Recurring utang reminders** — customers requested in-app due date reminders before installments are due, not just after they're overdue.
- **QR print-ready layout** — vendors want a printer-friendly QR page (A5 sticker format) they can paste on their stall. Builds on the download QR feature in commit [`dfcb790`](https://github.com/polsalarm/PalengkePay/commit/dfcb790).
- **Partial payment support** — some customers requested paying more than one installment at a time to close their utang early.

### Technical
- **Mainnet deployment** — migrate from Stellar Testnet to Mainnet once contracts are audited. Contract architecture is already production-ready (commit [`8c305b4`](https://github.com/polsalarm/PalengkePay/commit/8c305b4) fixed prod white-screen for WalletConnect).
- **Firebase / Supabase off-chain layer** — store vendor metadata and push notification tokens off-chain to reduce Soroban RPC calls and improve load time.
- **Multi-language (Filipino / English)** — EN·TL toggle already stubbed in the UI; wire up `i18n` library with full Tagalog translations.

---

## Local Setup

### Prerequisites

- Node.js 20+
- Rust + `wasm32v1-none` target
- [stellar-cli](https://github.com/stellar/stellar-cli) 25.2+
- Desktop: [Freighter wallet](https://www.freighter.app/) browser extension
- Mobile: [LOBSTR](https://lobstr.co/) app (WalletConnect)

### Frontend

```bash
cd frontend
npm ci --legacy-peer-deps
cp .env.example .env.local   # fill in contract IDs
npm run dev
```

On Windows PowerShell, if a transitive wallet package postinstall script fails with `yarn setup || true`, install with `npm ci --legacy-peer-deps --ignore-scripts`.

Open `http://localhost:5173`

Run frontend checks with:

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
npm run qa:visual
```

`npm run qa:visual` runs Playwright against desktop and mobile routes and writes screenshots to `frontend/qa-artifacts/`.

### Contracts

```bash
cd contracts
cargo test --workspace        # run all tests
stellar contract build        # build WASM for deployment
```

---

## Environment Variables

Create `frontend/.env.local`:

```env
VITE_STELLAR_NETWORK=testnet
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_VENDOR_REGISTRY_CONTRACT_ID=CA5QQ2SE4XTBX3K4XNHLNAL36GIJOJ3KXYDS2VLAYZC4Q5FAYMDWZUJH
VITE_PALENGKE_PAYMENT_CONTRACT_ID=CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF
VITE_UTANG_ESCROW_CONTRACT_ID=CD2VU3FLA473TCD67TBYXTQROWLJUUWVNPK56CMWBS6GW3N3ZO4JM5BG
VITE_UTANG_FEE_XLM=1
```

`VITE_UTANG_FEE_XLM` — XLM fee charged to vendors per utang QR creation (default: `1`).

Server-only fee sponsorship variables:

```env
SPONSOR_SECRET=SA...
FEE_BUMP_ALLOWED_DESTINATIONS=G...,G...
FEE_BUMP_RATE_LIMIT_WINDOW_MS=60000
FEE_BUMP_RATE_LIMIT_MAX=20
FEE_BUMP_MAX_INNER_XDR_BYTES=20000
FEE_BUMP_MAX_INNER_FEE_STROOPS=1000
FEE_BUMP_MAX_SPONSORED_OPS=1
FEE_BUMP_MAX_SPONSORED_XLM=100
```

`SPONSOR_SECRET` must be configured only in the deployment environment. Rate-limit and sponsorship limits have safe defaults, but production should use durable rate limiting because serverless in-memory buckets reset per instance. Set `FEE_BUMP_ALLOWED_DESTINATIONS` to a comma-separated allow list when sponsorship should be locked to known PalengkePay treasury/vendor accounts.

---

## Payment and Metrics Source of Truth

Current implementation:

- Customer QR payments prefer `PalengkePayment.pay` when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured.
- Checkout uses a PHP-first locked quote and dual-currency receipt before sending the XLM amount.
- Saved wallet proofs can be reopened at `/receipt/:txHash` for local receipt review, but final claims still require the hash to exist on Stellar Testnet.
- Vendor/customer history prefers `PalengkePayment` records and keeps Horizon/localStorage as fallback cache.
- Admin metrics prefer `PalengkePayment` records and use `VendorRegistry` counters only as a compatibility fallback.
- Direct fee-bumped Stellar transfer remains available as a local-dev or missing-contract fallback.

Remaining hardening:

1. Deferred for now: redeploy `PalengkePayment` with `get_customer_payments` so customer history can read the same contract source as vendor history.
2. Retire or further restrict manual `VendorRegistry.increment_stats` once no dashboard depends on registry counters.
3. Decide whether fee sponsorship should expand to tightly validated Soroban payment invocations.

---

## CI and Production Caveats

- GitHub Actions runs contract tests, contract fmt/clippy, frontend typecheck, lint, high-severity dependency audit, unit tests, build, and Playwright route QA on Node 20.
- Last upstream CI verified before this hardening: manual `workflow_dispatch` run `25807769027` passed on commit `7f24867` with `Contract Tests` and `Frontend Build` green.
- Local frontend verification for the previous hardening passed: `npx tsc --noEmit`, `npm test -- api/fee-bump.test.ts`, `npm run lint`, and `npm run build`.
- Current local shell does not put `cargo` on PATH, but `C:\Users\Admin\.cargo\bin\cargo.exe test --workspace` passed 33 contract tests, including the new `get_customer_payments` path.
- The app still runs on Stellar Testnet. Contract IDs, sponsor balances, and sponsor abuse controls must be rechecked before any mainnet deployment.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite 8 + TypeScript + Tailwind CSS v4 |
| Wallet | `@creit.tech/stellar-wallets-kit` — WalletConnect (mobile via LOBSTR), Freighter / xBull / Albedo (desktop) |
| Blockchain | Stellar Testnet + Soroban smart contracts (Rust, `soroban-sdk` 22.x) |
| QR | `qrcode.react` (generate + download) · `html5-qrcode` (camera scan + image upload) |
| PWA | `vite-plugin-pwa` + Workbox |
| Fee Sponsorship | Vercel serverless function (`api/fee-bump.ts`) + Stellar FeeBumpTransaction |
| Monitoring | `@sentry/react` + `/api/health` Horizon + RPC liveness check |
| Security | CSP + X-Frame-Options headers in `vercel.json` · input sanitization in `src/lib/sanitize.ts` · fee-bump XDR policy checks · Soroban signer auth on protected mutations |

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for step-by-step local setup, Vercel deployment, smoke checks, and Stellar Testnet reset recovery.

**Note:** Stellar Testnet resets periodically (~3 months). Redeploy contracts and update `.env.local` when that happens.
