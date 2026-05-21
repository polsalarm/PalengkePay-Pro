# Feature Inventory

## Confirmed Features

- QR-based customer payments with vendor and customer flows
- PHP-first checkout with quote lock and dual-currency receipt formatting
- Vendor application + approval workflow on-chain
- Utang (BNPL) create, view, and repayment flows
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
