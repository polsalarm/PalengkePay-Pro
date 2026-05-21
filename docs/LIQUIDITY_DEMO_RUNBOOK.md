# Liquidity Demo Runbook

## Demo URL

- Use `https://palengke-pay-beta.vercel.app`.
- Deployment verified against commit `0561a24`.
- `https://palengke-pay.vercel.app` is still not the active demo URL.

## Judge Walkthrough

1. Open `/customer/cashin`.
2. Enter a PHP amount of at least `50`.
3. Show the PDAX-style quote breakdown:
   - gross PHP
   - fee PHP
   - spread bps
   - estimated XLM
   - quote countdown
4. Click `Get quote`.
5. Show the QR Ph-style payment instruction card:
   - QR payload
   - proof reference
   - GCash / QR Ph settlement rail label
   - demo settlement mode label
6. Submit payment proof and explain that fiat settlement is mock/operator-confirmed.
7. Open `/admin/ramps`, enter the operator key, and show the pending cash-in.
8. Use `Release XLM` to move the cash-in to `pending_stellar`.
9. Open `/customer/cashout`.
10. Create a cash-out request with `EWALLET` or bank rail.
11. Open `/admin/ramps` and use `Mark PHP sent` to complete the payout.
12. Use CSV/JSON export to show operator audit evidence.
13. Open `/customer/testnet-wallet` to show the real Testnet wallet-signing path and Stellar Expert proof link.

## Operator Tools

- `Seed demo data` appends sample records only. It does not delete live/demo records.
- `CSV` export returns active-network audit rows.
- `JSON` export returns active-network ramp transaction objects.
- Admin actions require `RAMP_ADMIN_KEY`.

## Verified Live On 2026-05-21

- `/customer/cashin`: HTTP 200
- `/customer/cashout`: HTTP 200
- `/customer/testnet-wallet`: HTTP 200
- `/admin/ramps`: HTTP 200
- `/api/ramp/cashin?action=preview`: HTTP 200
- `/api/ramp/admin?action=seed_demo`: HTTP 200 with 4 records created
- `/api/ramp/admin?scope=all&export=json`: HTTP 200
- `/api/ramp/admin?scope=all&export=csv`: HTTP 200, `text/csv`

## Screenshots

Evidence folder:

- `docs/verification-evidence/20260521_0832-liquidity-demo/customer-cashin-quote-mobile.png`
- `docs/verification-evidence/20260521_0832-liquidity-demo/customer-cashout-connected-mobile.png`
- `docs/verification-evidence/20260521_0832-liquidity-demo/testnet-wallet-connected-mobile.png`
- `docs/verification-evidence/20260521_0832-liquidity-demo/admin-ramps-unlocked-desktop.png`

Packaged evidence:

- `docs/verification-packages/liquidity-demo-evidence-20260521_0832.zip`

## Known Limits

- `/api/health` is intentionally `503 degraded` until durable Redis/KV env is configured.
- Real XLM release from the anchor still requires a funded `ANCHOR_SIGNING_SECRET`.
- Real wallet signing on `/customer/testnet-wallet` requires a connected Testnet wallet.
- PDAX, GCash, and QR Ph settlement remain mock/operator-confirmed until production provider access exists.
