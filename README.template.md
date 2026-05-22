# PalengkePay

## 🧩 Problem
The Philippine wet market economy runs almost entirely on cash, locking vendors and customers out of formal finance.
- ~37.6M Filipinos unbanked (World Bank Findex 2025) — only 50.2% of adults own a financial account
- 45% of self-employed Filipinos unbanked (BSP 2021); track utang on paper or by memory
- 99.63% of registered PH businesses are MSMEs (DTI 2024) — most palengke vendors earn ₱1,000–₱4,999/day
- Vendors can't prove income for loans/aid; customers get no receipts and no structured repayment

## 🌟 Vision
A Philippines where every wet market vendor has a verifiable on-chain financial identity — provable income, transparent credit history, and cashless payments without a bank — built on open Stellar rails accessible to anyone with a phone.

## 🎯 Purpose
Built to break the cash-only exclusion cycle: give micro-entrepreneurs cryptographic proof of revenue, give customers tamper-proof receipts, and put utang (BNPL) on-chain so neither party loses track. Mission is financial inclusion, not crypto speculation.

## 👥 Target Users
PH wet market participants and micro-merchants outside the formal banking system.
- **Palengke Vendors** — fish/meat/produce stall owners selling daily, no bank account, want to track income and offer installment credit
- **Palengke Customers** — daily shoppers paying small amounts, want digital receipts and a clean way to manage utang
- **Market Administrators** — manage vendor onboarding, approvals, and dashboards per palengke

## ✨ Features
- **Gasless QR Payments** — vendor shows QR, customer scans and pays XLM in seconds; sponsor wallet absorbs all network fees via Stellar `FeeBumpTransaction`
- **PHP-First Stable Checkout** — customer enters PHP, app locks a short-lived PHP/XLM quote, dual-currency receipt after confirm
- **On-Chain Utang (BNPL)** — Soroban escrow with installments, 7-day grace, 1% reserve pool, 5% late-fee resume, on-chain default reputation
- **On-Chain Vendor Reputation** — 1–5 star ratings per payment, stored via `VendorRegistry.submit_rating`; one rating per `(vendor, tx_hash)`
- **Vendor Income Proof Pack** — per-period bank-ready certificate, CSV/JSON/text exports, wallet-signed Testnet attestation
- **SEP-24 Fiat Anchor + Cash-In / Cash-Out** — full SEP-1/10/24 anchor; PHP↔XLM via PDAX-mocked client with operator manual settlement console at `/admin/ramps`
- **Web Push Notifications** — VAPID-backed push for payments, utang accepted/paid/completed, due-soon/overdue reminders (daily cron)
- **Live Vendor Open/Closed Status** — toggle stored as Stellar account data entry, sponsored reserves keep it gasless
- **Public Shareable Receipts** — `/receipt/:txHash` read-only, Web Share API, OG previews, direct Stellar Expert link
- **Multi-Wallet + PWA** — Freighter / xBull / Albedo (desktop), LOBSTR via WalletConnect (mobile); installable on Android/iOS, no app store
- **EN / TL Toggle + PHP/XLM Display Switch + Hide-Balance Privacy Mode**

## 🛠️ Tech Stack
- **Frontend:** React 19 + Vite 8 + TypeScript + Tailwind CSS v4
- **Backend:** Vercel serverless functions (Node) — fee-bump, SEP-10 auth, SEP-24 dispatcher, push fan-out, ramp store, health
- **Blockchain:** Stellar (Soroban smart contracts in Rust `soroban-sdk` 22.x, Horizon API, Stellar SDK, SEP-1/10/24)
- **Other tools:** `@creit.tech/stellar-wallets-kit`, `qrcode.react`, `html5-qrcode`, `vite-plugin-pwa` + Workbox, `web-push` + VAPID, Upstash Redis (Vercel Marketplace), `@sentry/react`, CoinGecko price API, PDAX HMAC SHA-384 client (mock mode)

## 🚀 How to Run Locally
```bash
git clone https://github.com/polsalarm/PalengkePay
cd PalengkePay/frontend
npm ci --legacy-peer-deps
cp .env.example .env.local   # fill contract IDs + sponsor + VAPID + anchor envs
npm run dev
```
Contracts:
```bash
cd contracts
cargo test --workspace
stellar contract build
```
Open `http://localhost:5173`. Prereqs: Node 20+, Rust + `wasm32v1-none`, `stellar-cli` 25.2+, Freighter (desktop) or LOBSTR (mobile).

## 🌐 Deployment

### Testnet
- **VendorRegistry:** `CDEQVKKRIXJHQRZCMOKE65LL2LMDXOY3MHKXQ2AP2DNHP56NPIT2NLJR`
  - 📸 [Stellar Expert (Testnet) →](https://stellar.expert/explorer/testnet/contract/CDEQVKKRIXJHQRZCMOKE65LL2LMDXOY3MHKXQ2AP2DNHP56NPIT2NLJR)
  - ![VendorRegistry](UI/CONTRACT/VendorRegistry.png)
- **PalengkePayment:** `CDSCCIT7L5ZNY5AYHOA2T6HMDEXFR7ZVR6JEWHJXXQCSILOMDOEKW5WY`
  - 📸 [Stellar Expert (Testnet) →](https://stellar.expert/explorer/testnet/contract/CDSCCIT7L5ZNY5AYHOA2T6HMDEXFR7ZVR6JEWHJXXQCSILOMDOEKW5WY)
  - ![PalengkePayment](UI/CONTRACT/PalengkeyPayment.png)
- **UTangEscrow:** `CCPYLRKBCM4SSQYNEETXDWANEQ3Q7AB7SBS254L3CHTEGQADTX5IOI53`
  - 📸 [Stellar Expert (Testnet) →](https://stellar.expert/explorer/testnet/contract/CCPYLRKBCM4SSQYNEETXDWANEQ3Q7AB7SBS254L3CHTEGQADTX5IOI53)
  - ![UTangEscrow](UI/CONTRACT/UtangEscrow.png)

### Mainnet (deployed 2026-05-22)
- **VendorRegistry:** `CCTB5OMKU6DITCWOFM7LVZENSJXR3VSABAWG3GRXTFPXDPBH2FKATOLX`
  - 📸 [Stellar Expert (Mainnet) →](https://stellar.expert/explorer/public/contract/CCTB5OMKU6DITCWOFM7LVZENSJXR3VSABAWG3GRXTFPXDPBH2FKATOLX)
- **PalengkePayment:** `CCP6WOKMHH7AEX2JTP22EEAUTQ5EAPAECX4SMJ2P442QLD4J36277GBV`
  - 📸 [Stellar Expert (Mainnet) →](https://stellar.expert/explorer/public/contract/CCP6WOKMHH7AEX2JTP22EEAUTQ5EAPAECX4SMJ2P442QLD4J36277GBV)
- **UTangEscrow:** `CDW5HJWCXIAUI27F3WZRSFU4LETD7KIDOGTP4LEKFACETQVIFWV7XKIG` — BNPL cap 230 000 000 stroops (≈ ₱500)
  - 📸 [Stellar Expert (Mainnet) →](https://stellar.expert/explorer/public/contract/CDW5HJWCXIAUI27F3WZRSFU4LETD7KIDOGTP4LEKFACETQVIFWV7XKIG)
- Admin: `GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH` · Native XLM SAC: `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`
- Cash-in/cash-out (PDAX) remains testnet-only — mainnet ramps still blocked on PDAX CAAS + KMS custody.

## 🎬 Demo
- 🔗 **Live App:** [palengkepay-pro.vercel.app](https://palengkepay-pro.vercel.app)
- 🎥 **Demo Video (60s intro):** [YouTube Shorts →](https://www.youtube.com/shorts/WmEz41GHeng?feature=share)
- 🎥 **Full MVP Walkthrough:** [YouTube →](https://youtu.be/hOiuXBG5A3Q?si=lLhgmeAsGQVen8e1)
- 📊 **User Feedback (Google Sheets):** [View responses →](https://docs.google.com/spreadsheets/d/1g0AYRCwqc1-zcxy2q5UnIGHtllJHsXSaUvTCD7POI-g/edit?usp=sharing)
- 🖼️ **Pitch Deck:** _coming soon_

## 👤 Team
| Name | Role | GitHub |
|------|------|--------|
| Pol Salarm | Lead Developer / Builder | [@polsalarm](https://github.com/polsalarm) |

## 📄 License
MIT
