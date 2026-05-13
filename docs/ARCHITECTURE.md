# PalengkePay Architecture

Last updated: 2026-05-13

This document describes the current system architecture, the split source-of-truth problem, and the recommended target architecture.

## 1. System Overview

PalengkePay is a React/Vite PWA backed by Stellar Testnet and Soroban smart contracts. The frontend runs in the browser, wallet signing happens through Stellar wallet integrations, fee sponsorship is handled by a Vercel API function, and contract state is read/written through Soroban RPC.

```text
User browser / PWA
  -> React routes and shared UI components
  -> WalletProvider / Stellar wallet signing
  -> Horizon payment indexing for history cache
  -> Soroban RPC for contract reads/writes
  -> Vercel API functions for fee bump and health
  -> Stellar Testnet / Soroban contracts
```

## 2. Runtime Layers

| Layer | Responsibility | Key files |
| --- | --- | --- |
| UI routes | Customer, vendor, admin, onboarding, market, and demo pages | `frontend/src/pages/**` |
| Shared UI | Layout, wallet button, balance, QR, payment form, scanner, status, toast, utang card | `frontend/src/components/**` |
| Wallet/session | Wallet connection, signing, connected address state | `frontend/src/components/WalletProvider.tsx`, `frontend/src/lib/hooks/useWallet.ts` |
| Stellar client | Horizon/RPC clients, transaction builders, submit helpers | `frontend/src/lib/stellar.ts` |
| Feature hooks | Vendor, payment, utang, metrics, transactions, balance | `frontend/src/lib/hooks/**` |
| API functions | Fee bump sponsorship and health checks | `frontend/api/fee-bump.ts`, `frontend/api/health.ts` |
| Contracts | Vendor registry, payment contract, utang escrow | `contracts/*/src/lib.rs` |
| Verification | Vitest, TypeScript, ESLint, Playwright, Cargo, GitHub Actions | `frontend/package.json`, `.github/workflows/ci.yml` |

## 3. Current Source-of-Truth Map

| Domain | Current source | Read path | Write path | Caveat |
| --- | --- | --- | --- | --- |
| Live QR payments | `PalengkePayment` contract when configured | Contract record/event plus Horizon/local cache | `prepareContractTx()` -> wallet sign -> `submitSorobanTx()` | Metrics still read registry counters |
| Vendor profiles/applications | `VendorRegistry` contract | Soroban view calls through `useVendor` | Wallet-signed contract calls | Good contract source, but fixed page sizes need scale work |
| Admin metrics | `VendorRegistry` counters | `useMetrics` from registry records | Admin-only `increment_stats` exists | Metrics are not automatically derived from live QR payment path |
| Customer/vendor payment history | Horizon + localStorage | `useTransactions` / `indexer.ts` | Horizon observes Stellar transactions | Browser-local cache is not shared analytics state |
| Utang agreements | `UtangEscrow` contract | Soroban view calls through `useUtang` | Customer-signed contract calls | Target should become explicit vendor-offer/customer-accept |
| Fee sponsorship | Vercel API + sponsor account | API response | User-signed inner XDR wrapped by sponsor | In-memory rate limit is best-effort only |

## 4. Current Payment Flow

```text
Customer scans vendor QR
  -> PaymentForm collects amount/memo
  -> prepareContractTx(... PalengkePayment.pay ...)
  -> wallet signs contract transaction
  -> submitSorobanTx(signedXdr)
  -> Soroban executes token transfer and stores payment record
  -> Horizon/indexer later reads transaction for history
```

Important behavior:

- `PalengkePayment.pay` is preferred when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured.
- Direct fee-bumped Stellar transfer remains the missing-contract fallback.
- The fee-bump endpoint requires signed source, Testnet network, `PP:` memo, allowed operation types, amount/fee limits, and optional destination allowlist.

## 5. Current Contract Architecture

| Contract | Current role | Key writes | Key reads |
| --- | --- | --- | --- |
| `VendorRegistry` | Vendor applications, admin approval, profile/state, counters | `apply_vendor`, `approve_vendor`, `reject_vendor`, `register_vendor`, `update_profile`, `deactivate_vendor`, `increment_stats` | `get_vendor`, `get_application`, `get_pending_vendors`, `get_all_vendors`, `vendor_count`, `pending_count` |
| `PalengkePayment` | Payment records/events in contract code | `pay` | `get_payment`, `get_vendor_payments`, `payment_count` |
| `UtangEscrow` | Installment credit agreements | `create_utang`, `pay_installment`, `mark_default` | `get_utang`, `get_customer_utangs`, `get_vendor_utangs`, `utang_count` |

## 6. Architecture Problem

The codebase still has two payment concepts:

1. The live frontend path now prefers `PalengkePayment.pay`.
2. Direct Stellar payments through fee bump remain as a fallback when no payment contract ID is configured.

Metrics, future credit scoring, and admin dashboards can still drift until they read from the payment contract record/event source.

## 7. Recommended Target Architecture

The clean target is contract-first payments:

```text
Customer scans QR
  -> frontend builds a PalengkePayment.pay contract transaction
  -> wallet signs the contract call
  -> PalengkePayment emits payment event and stores record
  -> Vendor stats update from the same transaction path
  -> Admin metrics and PalengkeScore read from that canonical source
  -> Horizon/indexer remains UX cache and chain-history helper
```

Target rules:

- `PalengkePayment.pay` remains canonical for QR payments.
- Payment events and vendor stats come from the same transaction path.
- Horizon/localStorage is cache only.
- `VendorRegistry.increment_stats` is replaced or restricted to an authorized payment-contract/event-normalizer path.
- PalengkeScore and risk dashboards must not launch until payment truth is unified.

## 8. Security Boundaries

| Boundary | Current protection | Remaining hardening |
| --- | --- | --- |
| Wallet signing | User signs transactions through wallet provider | Add more frontend validation coverage |
| Fee sponsor | XDR policy checks, amount/fee limits, memo rule, allowlist, rate limit | Durable rate limiting and dynamic abuse testnet review |
| Vendor application | Applicant wallet auth | Continue form validation review |
| Admin mutations | Admin wallet auth | Key rotation/runbook |
| Utang mutation | Customer/admin auth depending on method | Vendor-offer/customer-accept redesign |
| Deployment | CSP/security headers in Vercel config | SECURITY.md and dependency scanning |

## 9. Data and Cache Boundaries

- Contract state is authoritative for vendor and utang records.
- Stellar ledger/Horizon remains a chain-history source and fallback transfer source.
- Browser localStorage is only a UX cache.
- Admin metrics are currently registry-derived counters.
- Future analytics should use a shared indexed event source rather than per-browser localStorage.

## 10. Architecture Decisions Pending

1. Decide whether vendor stats live in `PalengkePayment` or are updated in `VendorRegistry` through an authorized contract/event bridge.
2. Define a shared event model for payments, repayments, receipts, and score inputs.
3. Decide whether fee sponsorship should expand to tightly validated Soroban payment invocations.
4. Decide production rate-limiting provider for fee sponsorship.
5. Decide whether the next mobile product is PWA-only, Capacitor shell, or React Native app.
