# Wallet-Backed Manual E2E Runbook

Last updated: 2026-05-14

Use this runbook when you need to prove the real browser-to-wallet-to-Stellar path. Automated tests prove route rendering and disconnected-wallet states, but a full payment claim requires a signed Testnet transaction hash.

## Preconditions

- Testnet contract IDs are configured in `frontend/.env.local` or Vercel.
- Customer wallet has Testnet XLM.
- Vendor wallet has a registered and approved vendor profile.
- Browser wallet is available:
  - Desktop: Freighter, xBull, or Albedo.
  - Mobile: LOBSTR through WalletConnect.
- Never paste `SPONSOR_SECRET` or wallet secret keys into chat, screenshots, docs, or browser devtools.

## Local Preflight

From `frontend`:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run qa:visual
npm run dev -- --host 127.0.0.1 --port 5173
```

From another shell:

```powershell
Invoke-WebRequest http://127.0.0.1:5173/api/health -UseBasicParsing
```

Expected:

- Health reports `status: "ok"` or a documented dependency degradation.
- Browser route QA passes before manual wallet testing starts.

## Manual Payment Proof

1. Open `http://127.0.0.1:5173/connect`.
2. Connect the customer wallet.
3. Confirm the connected wallet address appears in the app shell.
4. Open `/market` or use a known approved vendor wallet.
5. As the vendor, open `/vendor/qr` in another browser profile/device and display the payment QR.
6. As the customer, open `/customer/scan`.
7. Scan the vendor QR or enter the vendor Stellar address manually.
8. Enter a small PHP amount and memo, for example `E2E smoke`.
9. Confirm the PHP/XLM quote and sign the wallet prompt.
10. Wait for the success state and copy the transaction hash.
11. Open the transaction on Stellar Expert Testnet.
12. Verify the transaction source/customer, vendor destination or contract invocation, memo/receipt context, and successful ledger result.

Evidence to capture:

- Customer wallet public address, redacted to first/last characters if shared.
- Vendor wallet public address, redacted if shared.
- Transaction hash.
- Stellar Expert Testnet URL.
- Screenshot of the app success state.
- Screenshot or copied status from `/api/health`.

## History and Metrics Proof

After a successful payment:

1. Open `/customer/history`.
2. Confirm the recent payment appears once.
3. Open `/vendor/transactions`.
4. Confirm the recent payment appears once for the vendor.
5. Open `/admin/metrics`.
6. Confirm the transaction count and volume update.
7. Note whether the UI reports `PalengkePayment` records or a fallback source.

If the history or metrics surface does not update, record:

- whether the transaction hash exists on Stellar Expert,
- whether the payment used `PalengkePayment.pay` or classic Stellar fallback,
- current `VITE_PALENGKE_PAYMENT_CONTRACT_ID`,
- browser console/API errors without exposing secrets.

## Manual Utang Proof

1. Connect the vendor wallet.
2. Open `/vendor/utang`.
3. Create a small installment offer with a clear item description.
4. Generate the utang QR.
5. Connect the customer wallet in another profile/device.
6. Open `/customer/scan` and scan/upload the utang QR.
7. Review the amount, installment count, interval, vendor wallet, and description.
8. Sign the customer acceptance prompt.
9. Confirm the resulting transaction hash on Stellar Expert.
10. Open `/customer/utang` and `/vendor/utang` to verify both sides show the agreement.

Evidence to capture:

- Offer terms.
- Acceptance transaction hash.
- Customer and vendor list states after refresh.

## Live Deployment Smoke

For the hosted app:

```powershell
$base = "https://palengke-pay.vercel.app"
Invoke-WebRequest "$base/" -UseBasicParsing
Invoke-WebRequest "$base/connect" -UseBasicParsing
Invoke-WebRequest "$base/api/health" -UseBasicParsing
```

Then repeat the wallet-backed payment proof against the live URL. Do not call the live app fully E2E until a signed transaction hash is captured.

## Pass Criteria

The wallet-backed E2E pass is complete only when:

- local or live health was checked,
- the browser reached the success state,
- a wallet signed the transaction,
- Stellar Testnet shows a successful transaction hash,
- customer history, vendor history, or admin metrics were checked after the transaction,
- any missing update path is documented with exact route and error evidence.
