# PalengkePay User Flows

Last updated: 2026-05-13

This document turns the current feature inventory into skimmable end-to-end user journeys. It documents what each role can do today, the expected route path, the source modules, and the known caveats.

## 1. Public and Onboarding Flows

### 1.1 Landing and Product Walkthrough

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open public app | `/` | `frontend/src/pages/Landing.tsx` |
| 2 | Review product story, screenshots, and call to action | Landing page sections | `README.md`, `UI/WEB/landing/*`, `UI/MOBILE/landingpage/*` |
| 3 | Move into wallet connection | CTA to `/connect` | `frontend/src/App.tsx` |

### 1.2 Wallet Connection

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Choose wallet provider | `/connect` | `frontend/src/pages/Connect.tsx` |
| 2 | Connect desktop wallet or WalletConnect mobile wallet | Wallet provider UI | `frontend/src/components/WalletProvider.tsx` |
| 3 | App stores connected wallet in provider state | Wallet context | `frontend/src/lib/hooks/useWallet.ts` |
| 4 | Continue to onboarding | `/onboard` | `frontend/src/App.tsx` |

Current caveats:

- WalletConnect depends on a valid project/origin configuration.
- Production wallet behavior must be checked on real mobile devices, not only desktop browser tests.

### 1.3 Testnet Funding and Role Selection

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Check wallet and testnet readiness | `/onboard` | `frontend/src/pages/Onboard.tsx` |
| 2 | Fund testnet wallet through Friendbot/onboarding guidance | Onboarding flow | `README.md` |
| 3 | Choose customer, vendor, or admin path | Onboarding role actions | `frontend/src/pages/Onboard.tsx` |

## 2. Customer Flows

### 2.1 Customer Home

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open customer dashboard | `/customer/home` | `frontend/src/pages/customer/CustomerHome.tsx` |
| 2 | Review balance and navigation shortcuts | Customer shell/components | `frontend/src/components/BalanceDisplay.tsx`, `frontend/src/components/Layout.tsx` |

### 2.2 QR Payment

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Scan vendor QR or enter vendor wallet manually | `/customer/scan` | `frontend/src/pages/customer/CustomerScan.tsx`, `frontend/src/components/QRScanner.tsx` |
| 2 | Review vendor identity and payment form | Payment form | `frontend/src/components/PaymentForm.tsx` |
| 3 | Sign `PalengkePayment.pay` contract transaction when configured | Wallet provider | `frontend/src/components/WalletProvider.tsx`, `frontend/src/lib/hooks/usePayment.ts` |
| 4 | Submit contract transaction; fallback to fee-bump only if no payment contract ID is configured | Payment hook | `frontend/src/lib/stellar.ts`, `frontend/api/fee-bump.ts` |
| 5 | Show transaction status/hash | Status tracker/toast | `frontend/src/components/TxStatusTracker.tsx`, `frontend/src/components/Toast.tsx` |

Current caveat:

- Live QR payments prefer `PalengkePayment.pay` when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured.

### 2.3 Customer Transaction History

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open history | `/customer/history` | `frontend/src/pages/customer/CustomerHistory.tsx` |
| 2 | App loads cached history first | Transaction hook | `frontend/src/lib/hooks/useTransactions.ts` |
| 3 | App syncs Horizon payments in background | Indexer | `frontend/src/lib/indexer.ts` |

Current caveat:

- Browser localStorage and Horizon indexing are UX/cache layers, not the business source of truth.

### 2.4 Accept and Pay Utang

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Scan or upload vendor utang QR | `/customer/scan` or `/customer/utang` | `frontend/src/pages/customer/CustomerScan.tsx`, `frontend/src/pages/customer/CustomerUtang.tsx` |
| 2 | Review installment terms | Customer utang UI | `frontend/src/components/UtangCard.tsx` |
| 3 | Sign customer-authorized creation/acceptance transaction | Utang hook | `frontend/src/lib/hooks/useUtang.ts` |
| 4 | Pay installment | Customer utang UI | `frontend/src/lib/hooks/useUtang.ts`, `contracts/utang-escrow/src/lib.rs` |
| 5 | Status becomes active, completed, or defaulted | Contract state | `contracts/utang-escrow/src/lib.rs` |

Current caveat:

- The target architecture is a true on-chain vendor-offer/customer-accept model. The current implementation is closer to customer-authorized creation from a vendor-generated offer payload.

## 3. Vendor Flows

### 3.1 Vendor Application

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open application | `/vendor/apply` | `frontend/src/pages/vendor/VendorApply.tsx` |
| 2 | Submit name, stall, product type, and phone | Apply form | `frontend/src/lib/hooks/useVendor.ts` |
| 3 | Wallet signs `apply_vendor` | Vendor hook and contract | `frontend/src/lib/hooks/useVendor.ts`, `contracts/vendor-registry/src/lib.rs` |
| 4 | Application appears in admin pending list | Admin market | `frontend/src/pages/admin/AdminMarket.tsx` |

Security note:

- `apply_vendor` requires applicant wallet auth.

### 3.2 Vendor Dashboard and Profile

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open vendor home | `/vendor/home` | `frontend/src/pages/vendor/VendorHome.tsx` |
| 2 | View status, stats, and navigation | Vendor pages | `frontend/src/lib/hooks/useVendor.ts` |
| 3 | Open or update profile | `/vendor/profile` | `frontend/src/pages/vendor/VendorProfile.tsx` |

### 3.3 Vendor Payment QR

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open QR page | `/vendor/qr` | `frontend/src/pages/vendor/VendorQR.tsx` |
| 2 | Generate customer-facing payment QR | QR component | `frontend/src/components/QRGenerator.tsx` |
| 3 | Customer scans QR and pays | Customer flow | `frontend/src/pages/customer/CustomerScan.tsx` |

### 3.4 Vendor Transactions

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open transaction history | `/vendor/transactions` | `frontend/src/pages/vendor/VendorTransactions.tsx` |
| 2 | App loads vendor-side cached payments | Transactions hook | `frontend/src/lib/hooks/useTransactions.ts` |
| 3 | App syncs Horizon payments in background | Indexer | `frontend/src/lib/indexer.ts` |

### 3.5 Vendor Utang Offers

| Step | User action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open vendor utang page | `/vendor/utang` | `frontend/src/pages/vendor/VendorUtang.tsx` |
| 2 | Enter customer wallet, amount, items, interval, and installments | Vendor utang form | `frontend/src/pages/vendor/VendorUtang.tsx` |
| 3 | Generate QR/manual offer payload | Vendor utang UI | `frontend/src/pages/vendor/VendorUtang.tsx`, `frontend/src/components/QRGenerator.tsx` |
| 4 | Customer accepts from their wallet | Customer utang flow | `frontend/src/lib/hooks/useUtang.ts` |

## 4. Admin Flows

### 4.1 Market Dashboard

| Step | Admin action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open market dashboard | `/admin/market` | `frontend/src/pages/admin/AdminMarket.tsx` |
| 2 | Review pending vendors | Pending list | `frontend/src/lib/hooks/useVendor.ts` |
| 3 | Approve or reject applications | Admin actions | `frontend/src/lib/hooks/useVendor.ts`, `contracts/vendor-registry/src/lib.rs` |
| 4 | Deactivate vendors when needed | Admin market | `frontend/src/pages/admin/AdminMarket.tsx` |

Security note:

- Admin mutations require the configured admin wallet.

### 4.2 Manual Vendor Registration

| Step | Admin action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open manual registration | `/admin/register` | `frontend/src/pages/admin/AdminRegister.tsx` |
| 2 | Enter vendor details | Admin form | `frontend/src/pages/admin/AdminRegister.tsx` |
| 3 | Submit `register_vendor` transaction | VendorRegistry | `contracts/vendor-registry/src/lib.rs` |

### 4.3 Metrics Dashboard

| Step | Admin action | App route/surface | Evidence |
| --- | --- | --- | --- |
| 1 | Open metrics dashboard | `/admin/metrics` | `frontend/src/pages/admin/AdminMetrics.tsx` |
| 2 | Review active/pending vendors, transaction count, volume, average size, product breakdown, and top vendors | Metrics hook | `frontend/src/lib/hooks/useMetrics.ts` |

Current caveat:

- Metrics read `VendorRegistry` counters. The next architecture step is to unify metrics with the canonical payment source.

## 5. Demo and Internal Utility Flows

| Flow | Route/surface | Purpose | Evidence |
| --- | --- | --- | --- |
| Generic dashboard | `/dashboard` | Shared landing after role selection/demo routing | `frontend/src/pages/Dashboard.tsx` |
| Test send | `/test-send` | Internal/demo transaction sending path | `frontend/src/pages/TestSend.tsx` |
| Market directory | `/market` | Public/customer vendor discovery | `frontend/src/pages/MarketDirectory.tsx` |

## 6. Flow Gaps to Resolve

1. Replace admin-only vendor stat mutation with payment-driven stats.
2. Move from browser-local transaction history to a shared event/read model for analytics.
3. Upgrade utang to true vendor-offer/customer-accept contract flow.
4. Add durable fee-bump rate limiting before production.
5. Add signed invoice or reusable checkout payloads for stronger QR semantics.
