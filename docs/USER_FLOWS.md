# User Flows

## Customer

1. Open app and connect wallet.
2. Go to scan flow (`/customer/scan`) and pay with XLM via memo-bound path.
3. Review history and receipts (`/customer/history`, `/receipt/:txHash`).
4. Use utang flow (`/customer/utang`) where available.

## Vendor

1. Apply via `/vendor/apply` (public) or use onboarding/dashboard.
2. Publish QR in `/vendor/qr` and monitor `/vendor/transactions`.
3. Manage profile and utang options from `/vendor/profile`, `/vendor/utang`.

## Admin

1. Open `/admin/market` for pending/registered vendor management.
2. Register vendors manually in `/admin/register`.
3. Inspect metrics at `/admin/metrics` and operational status at `/admin/health` + `/admin/proofs`.

## Demo/Smoke Paths

- `/` landing and onboarding
- `/connect`, `/onboard`, `/market`
- `/receipt/demo-hash`
- `/admin/health`, `/admin/proofs`
