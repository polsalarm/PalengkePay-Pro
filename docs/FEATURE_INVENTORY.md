# Feature Inventory

## Confirmed Features

- QR-based customer payments with vendor and customer flows
- PHP-first checkout with quote lock and dual-currency receipt formatting
- Vendor application + approval workflow on-chain
- Utang (BNPL) create, view, and repayment flows
- Utang default handling (deployed 2026-05-21):
  - 7-day admin-configurable grace period past `next_due` before default eligible
  - 1% reserve skimmed from each `pay_installment` into per-utang contract custody; paid to vendor on default, refunded to customer on completion
  - 5% late fee `resume_after_late` flow — customer pays vendor direct, status `Defaulted → Active`, `next_due` reset
  - On-chain default reputation: `customer_defaults` + `vendor_defaults` counters in utang-escrow; `customer_defaults_history` + `vendor_defaults_received` mirrors in vendor-registry via admin `report_default`
  - Admin Utang dashboard (`/admin/utang`) with Default-ready / Overdue / Defaulted / All filters and grace-aware `Mark Default` button
  - Customer Utang page surfaces on-chain defaults count chip + Resume bottom sheet for defaulted plans
- Vendor proof, history, and export/recovery surfaces
- Admin dashboard for pending vendors, metrics, health, and proofs
- Gasless fee sponsorship API path with policy checks
- Contract-first payment architecture path with contract registry and local fallback behavior
- Testnet-first liquidity rail with PDAX-style quotes, QR Ph-style payment instruction cards, fee/spread simulator, and operator-confirmed settlement.
- Ramp operator audit export for CSV/JSON plus seed-only demo records for judging.
- Customer Testnet wallet check flow with Stellar Expert transaction proof links.
- PWA shell with service worker registration

## In-Progress / Guardrails

- Live production proof sync remains manual for wallet-signed test transactions.
- Deployment parity with the latest uncommitted local changes is not yet proven live.
- Durable KV/Redis is still required for production-grade persistence and fully green `/api/health`.
- Real XLM release from the anchor still requires a funded `ANCHOR_SIGNING_SECRET`.
