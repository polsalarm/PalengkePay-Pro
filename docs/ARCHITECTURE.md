# Architecture

## Layers

- **Frontend (React/Vite/TS)**: route-driven UI, wallet context providers, hooks, and local caching.
- **Serverless API (`frontend/api`)**: fee-bump wrapper and environment-backed health endpoint.
- **Soroban Contracts (Rust)**:
  - `vendor-registry`
  - `palengke-payment`
  - `utang-escrow`
- **State Mix Strategy**:
  - Contract-first sources where available
  - Horizon/indexer + cache as fallback/read-path for resilience

## Payment Modes

- Preferred contract payment when `VITE_PALENGKE_PAYMENT_CONTRACT_ID` is configured.
- Fee-sponsorship fallback for classic Stellar transfer path when needed.
