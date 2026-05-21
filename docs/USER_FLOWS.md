# User Flows

## Customer

1. Open app and connect wallet.
2. Go to scan flow (`/customer/scan`) and pay with XLM via memo-bound path.
3. Review history and receipts (`/customer/history`, `/receipt/:txHash`).
4. Use utang flow (`/customer/utang`) where available.
5. Use liquidity flows:
   - `/customer/cashin` for PHP to XLM with rate/fee simulator, QR Ph-style reference card, proof reference, and operator-confirmed demo settlement.
   - `/customer/cashout` for XLM to PHP with GCash / QR Ph / bank rail selection and operator-confirmed payout.
   - `/customer/testnet-wallet` for a small Testnet XLM send and Stellar Expert proof link.

## Vendor

1. Apply via `/vendor/apply` (public) or use onboarding/dashboard.
2. Publish QR in `/vendor/qr` and monitor `/vendor/transactions`.
3. Manage profile and utang options from `/vendor/profile`, `/vendor/utang`.

## Admin

1. Open `/admin/market` for pending/registered vendor management.
2. Register vendors manually in `/admin/register`.
3. Inspect metrics at `/admin/metrics` and operational status at `/admin/health` + `/admin/proofs`.
4. Manage liquidity settlements at `/admin/ramps`.
   - Enter `RAMP_ADMIN_KEY`.
   - Approve cash-in XLM release or cash-out PHP sent states.
   - Export active-network ramp audit logs as CSV or JSON.
   - Seed non-destructive demo records for judge walkthroughs.

## Demo/Smoke Paths

- `/` landing and onboarding
- `/connect`, `/onboard`, `/market`
- `/receipt/demo-hash`
- `/admin/health`, `/admin/proofs`
- `/customer/cashin`, `/customer/cashout`, `/customer/testnet-wallet`, `/admin/ramps`
