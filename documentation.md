# PalengkePay Phase 3 — Fiat Ramp Documentation

Hackathon-grade SEP-24 anchor + PDAX-mocked fiat ramp. Real testnet XLM, manual PHP settlement by operator.

---

## 1. One-time setup

### 1.1 Generate anchor keypair

```bash
cd frontend
node ../scripts/setup-anchor.mjs
```

Prints public/secret keypair, funds it on testnet via friendbot (10k XLM), and lists env vars to set.

### 1.2 Set env vars on Vercel

Either via dashboard (Settings → Environment Variables) or CLI:

```bash
npm i -g vercel
vercel link
# repeat per var, per scope (production/preview/development):
echo "<value>" | vercel env add <NAME> <scope>
```

| Variable | Required | Value |
|---|---|---|
| `ANCHOR_SIGNING_SECRET` | yes | Stellar secret from setup script |
| `ANCHOR_HOME_DOMAIN` | yes | `palengkepay-pro.vercel.app` |
| `ANCHOR_BASE_URL` | yes | `https://palengkepay-pro.vercel.app` |
| `ANCHOR_NETWORK_PASSPHRASE` | yes | `Test SDF Network ; September 2015` |
| `ANCHOR_HORIZON_URL` | yes | `https://horizon-testnet.stellar.org` |
| `PDAX_MOCK` | yes | `true` (hackathon mode) |
| `RAMP_ADMIN_KEY` | yes | Random hex from setup script |
| `RAMP_RATE_FALLBACK` | no | PHP per XLM rate, defaults `7.85` |
| `ANCHOR_JWT_SECRET` | no | Falls back to `ANCHOR_SIGNING_SECRET` |
| `PDAX_API_KEY` / `PDAX_API_SECRET` | no | Only for live mode |

Reuse existing push notification env vars (already configured):
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash, auto-injected)

### 1.3 Redeploy

```bash
vercel --prod
```

Anchor is live at `https://palengkepay-pro.vercel.app/.well-known/stellar.toml`.

---

## 2. Architecture

### 2.1 Components

| Layer | File | Purpose |
|---|---|---|
| SEP-1 toml | `frontend/api/stellar-toml.ts` | Dynamic, exposes anchor SIGNING_KEY |
| SEP-10 auth | `frontend/api/sep10/auth.ts` | Challenge-response → JWT |
| SEP-24 | `frontend/api/sep24/*` | info, deposit, withdraw, transactions |
| PDAX client | `frontend/api/_pdax.ts` | HMAC SHA-384, mock mode |
| Anchor wallet | `frontend/api/_anchor.ts` | Signs/submits real Stellar payments |
| Ramp store | `frontend/api/_rampStore.ts` | Upstash Redis state |
| Cashout API | `frontend/api/ramp/cashout.ts` | Off-ramp orchestration |
| Cashin API | `frontend/api/ramp/cashin.ts` | On-ramp orchestration |
| Status API | `frontend/api/ramp/status.ts` | Poll endpoint |
| Admin API | `frontend/api/ramp/admin.ts` | Operator settlement |
| JWT helper | `frontend/api/_jwt.ts` | HS256 sign/verify |
| Customer cashout | `frontend/src/pages/customer/CustomerCashout.tsx` | UI |
| Customer cashin | `frontend/src/pages/customer/CustomerCashin.tsx` | UI |
| Admin ramps | `frontend/src/pages/admin/AdminRamps.tsx` | Operator UI |
| Ramp client lib | `frontend/src/lib/ramp.ts` | Frontend wrapper |

### 2.2 Ramp txn statuses

| Status | Meaning |
|---|---|
| `incomplete` | Quote drafted, no action yet |
| `pending_user_transfer_start` | Cashout: waiting for customer to send XLM |
| `pending_anchor` | Anchor processing (Horizon verification, PDAX swap) |
| `pending_external` | Awaiting operator/PDAX fiat leg |
| `pending_stellar` | XLM withdrawal in flight (cashin) |
| `completed` | Terminal success |
| `error` | Terminal failure |

---

## 3. User flows

### 3.1 Cashout (XLM → PHP)

```
Customer                Backend                  Anchor (Stellar)     Operator
   |  POST /api/ramp/cashout?action=create        |                    |
   |---------------------------|                  |                    |
   |    {id, depositAddress, memo}|                |                    |
   |<--------------------------|                   |                    |
   |  Sign + submit XLM payment with memo=id       |                    |
   |--------------------------------------------->|                    |
   |  POST /api/ramp/cashout?action=settle        |                    |
   |---------------------------|                  |                    |
   |   verify via Horizon (memo/amount/dest)       |                    |
   |   placeOrder mock → amountOut PHP             |                    |
   |   requestCashout mock → PENDING               |                    |
   |   status = pending_external                   |                    |
   |   push: "awaiting PHP payout"                 |                    |
   |                                              |                    |
   |                          GET /api/ramp/admin |                    |
   |                          <-----------------------------------|    |
   |                          POST mark_php_sent  |                    |
   |                          <-----------------------------------|    |
   |   push: "PHP delivered"                       |                    |
   |<--- (push notification) -                     |                    |
```

### 3.2 Cashin (PHP → XLM)

```
Customer                Backend                  Anchor (Stellar)     Operator
   |  POST /api/ramp/cashin?action=quote          |                    |
   |---------------------------|                  |                    |
   |    {id, amountXlm, rate, reference}           |                    |
   |<--------------------------|                   |                    |
   |  (customer pays PHP via GCash/InstaPay)       |                    |
   |    referenced by id                           |                    |
   |  POST /api/ramp/cashin?action=confirm        |                    |
   |---------------------------|                  |                    |
   |   status = pending_external                   |                    |
   |                                              |                    |
   |                          POST release_xlm    |                    |
   |                          <-----------------------------------|    |
   |                          anchor.sendPayment XLM → customer        |
   |                          ----------------------->|                |
   |   status = completed, stellarTxHash recorded  |                    |
   |   push: "XLM received"                        |                    |
   |<--- (push notification) -                     |                    |
```

---

## 4. Operator runbook

> **The `/admin/ramps` page is hidden.** No nav link anywhere in the UI — URL-only access. Page also requires `RAMP_ADMIN_KEY`, and the underlying `/api/ramp/admin` endpoint returns 401 without the matching `x-admin-key` header. Two gates: URL discovery + key.

### 4.1 Daily routine

1. Open `https://palengkepay-pro.vercel.app/admin/ramps`
2. Paste `RAMP_ADMIN_KEY` to unlock (one-time per device)
3. Two sections:
   - **Cashouts awaiting PHP payout** — customer's XLM is in anchor account. Verify on Stellar Expert (link in card). Send PHP to customer's bank/e-wallet manually. Click "Mark PHP sent".
   - **Cashins awaiting XLM release** — customer claims to have paid PHP. Check your GCash/bank inbox for matching reference (txn id). Once confirmed, click "Release XLM" — anchor sends real testnet XLM to customer wallet.

### 4.2 Handling failures

- Customer claims PHP paid but you didn't receive it → ask for screenshot. If invalid, click "Fail" with reason → customer push-notified, txn marked `error`.
- Customer's XLM didn't arrive at anchor → check Horizon. Verify failed = txn auto-marked `error`. Customer must redo.
- Anchor balance low → top up via friendbot:
  ```
  node scripts/setup-anchor.mjs --fund-only GCQHI5SAV3NX2DGVQ7P6PJIJBF2HX4L5GYNNLYV576YM6JFYB2RF7YOT
  ```

### 4.3 Monitoring

- Stellar Expert testnet for anchor activity: `https://stellar.expert/explorer/testnet/account/<ANCHOR_PUBKEY>`
- Upstash dashboard for ramp txn state (`pp:ramp:*` keys)
- Vercel logs for API errors

---

## 5. SEP-24 spec compliance

| Endpoint | Path | Status |
|---|---|---|
| Stellar toml | `/.well-known/stellar.toml` | ✓ |
| SEP-10 challenge | `GET /api/sep10/auth?account=G...` | ✓ |
| SEP-10 token | `POST /api/sep10/auth` | ✓ |
| SEP-24 info | `GET /api/sep24/info` | ✓ |
| Deposit interactive | `POST /api/sep24/transactions/deposit/interactive` | ✓ |
| Withdraw interactive | `POST /api/sep24/transactions/withdraw/interactive` | ✓ |
| Transaction | `GET /api/sep24/transaction?id=...` | ✓ |
| Transactions | `GET /api/sep24/transactions` | ✓ |

External Stellar wallets (Lobstr, Freighter, Albedo) should be able to discover the anchor via the toml and use the interactive flow.

---

## 6. Mainnet migration

See `plan.md` → "Phase 3 — Fiat ramp (SEP-24 + PDAX) mainnet migration" section.

**Blocked on:**
- PDAX CAAS partnership signed
- KYC integration
- Anchor key in KMS (not env var)
- Refund path coded
- Daily limits + monitoring

**Do not** run manual operator settlement on mainnet — unlicensed remittance = legal exposure.

---

## 7. Deployed anchor (testnet)

Currently running on Stellar Testnet, funded via friendbot, May 2026 deploy.

- **Anchor public key:** `GCQHI5SAV3NX2DGVQ7P6PJIJBF2HX4L5GYNNLYV576YM6JFYB2RF7YOT`
- **Stellar Expert:** https://stellar.expert/explorer/testnet/account/GCQHI5SAV3NX2DGVQ7P6PJIJBF2HX4L5GYNNLYV576YM6JFYB2RF7YOT
- **TOML:** https://palengkepay-pro.vercel.app/.well-known/stellar.toml
- **Web auth:** https://palengkepay-pro.vercel.app/api/sep10/auth
- **Transfer server:** https://palengkepay-pro.vercel.app/api/sep24

### What the anchor public key is for

The pubkey is the **Stellar account that holds and signs for ramp custody**. It plays three roles:

1. **SEP-10 challenge signer.** External wallets (Lobstr, Freighter) discover this key from `stellar.toml` (`SIGNING_KEY` field) and verify it counter-signs SEP-10 challenges — that's how they trust the anchor is who it claims to be.
2. **Cashout deposit address.** When a customer cashes out XLM → PHP, our backend tells them "send your XLM to this address with memo = txn id." The address is the anchor pubkey. After XLM arrives, the operator pays PHP off-chain.
3. **Cashin payout source.** When a customer cashes in PHP → XLM, the operator confirms PHP arrived, then the anchor pubkey is the account that signs and submits the outbound XLM payment back to the customer's wallet.

The anchor secret (in Vercel env, not in this doc) is what the server uses to sign on behalf of the pubkey. Anyone with the secret can drain the account, so it's encrypted in Vercel and never logged.

---

## 8. Testing the ramp end-to-end

### 8.1 Smoke tests (no UI)

```bash
# Toml served correctly?
curl https://palengkepay-pro.vercel.app/.well-known/stellar.toml

# SEP-24 info served?
curl https://palengkepay-pro.vercel.app/api/sep24/info

# SEP-10 challenge for any Stellar account?
curl "https://palengkepay-pro.vercel.app/api/sep10/auth?account=GCQHI5SAV3NX2DGVQ7P6PJIJBF2HX4L5GYNNLYV576YM6JFYB2RF7YOT"
# Returns base64 XDR challenge + network_passphrase

# Admin pending list (requires the admin key)?
curl -H "x-admin-key: <RAMP_ADMIN_KEY>" https://palengkepay-pro.vercel.app/api/ramp/admin
# Returns { transactions: [...] }
```

### 8.2 Full cashout test (XLM → PHP)

Two browsers, two roles: **Customer** and **Operator**.

**Customer browser:**

1. Open https://palengkepay-pro.vercel.app
2. Connect Freighter/Lobstr (testnet). Must have ≥ 10 XLM.
3. Go to `/customer/profile` → tap **Cash Out**
4. Enter:
   - Amount: `10` (XLM)
   - Payout: `EWALLET`
   - Account: `09171234567` (or any test value)
   - Beneficiary: your name
5. Tap **Continue** → backend returns anchor address + memo (the txn id)
6. Tap **Send XLM from my wallet** → wallet popup → sign
7. Page shows "Swapping XLM → PHP on PDAX…" then "Awaiting operator to release PHP payout"
8. Customer push-notification fires: "PalengkePay — paying out"

**Operator browser:**

1. Open https://palengkepay-pro.vercel.app/admin/ramps
2. Paste `RAMP_ADMIN_KEY` (the value in Vercel env)
3. See the cashout in "Cashouts awaiting PHP payout" section
4. Click the Stellar Expert link → verify the inbound XLM hit anchor with correct memo
5. Manually send PHP via GCash/InstaPay to customer (skip for pure test)
6. Click **Mark PHP sent**

**Customer browser** receives push: "PalengkePay — cashout complete". Status updates to `completed`.

### 8.3 Full cashin test (PHP → XLM)

**Customer browser:**

1. Same wallet connect as above
2. Go to `/customer/profile` → tap **Cash In**
3. Enter `100` PHP → **Get quote**
4. See "Pay PHP 100 via INSTAPAY, reference: rmp_xxx"
5. Pretend you paid (skip actual transfer for testing)
6. Tap **I have paid — proceed**
7. Status: "PHP payment claimed, awaiting operator confirmation"

**Operator browser:**

1. Refresh `/admin/ramps`
2. See cashin in "Cashins awaiting XLM release"
3. (In real flow: check your GCash inbox for reference. In test: just verify the txn shows up.)
4. Click **Release XLM**
5. Backend calls anchor → real testnet XLM sent from anchor account to customer wallet
6. Operator sees `stellarTxHash` link → can view on Stellar Expert

**Customer browser** receives push: "XLM received". Wallet balance increases by ~12.74 XLM (100 PHP / 7.85 rate).

### 8.4 SEP-24 from an external wallet

This is the "anchor is interoperable" test — no PalengkePay UI involved:

1. In any SEP-24 compatible wallet (Lobstr, Freighter, Stellar Reference Wallet), add anchor by domain: `palengkepay-pro.vercel.app`
2. Wallet fetches `stellar.toml`, verifies SIGNING_KEY
3. Wallet runs SEP-10 challenge → gets JWT
4. Wallet shows "Deposit XLM" and "Withdraw XLM" buttons
5. Tap one → wallet opens our `/customer/cashin` or `/customer/cashout` page inside an iframe/webview
6. Flow continues identical to in-app

### 8.5 Local dev testing

```bash
cd frontend
npm run dev
```

Local API routes don't run by default in `vite dev`. To exercise the full ramp locally:

```bash
cd frontend
vercel dev   # runs serverless functions on http://localhost:3000
```

Pull env vars first:

```bash
vercel env pull .env.local
```

This writes a local `.env.local` with all the testnet config (already gitignored).

### 8.6 Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Cashout settle returns `horizon verification failed` | Wrong memo or wallet sent to wrong account | Customer must use the address + memo returned by the create response, exactly |
| Cashin "Release XLM" returns 500 with `op_low_reserve` | Anchor account below 1 XLM minimum reserve | Top up via `node scripts/setup-anchor.mjs --fund-only <pubkey>` |
| Admin page 401 on every action | Wrong `RAMP_ADMIN_KEY` in localStorage | Click "lock", paste correct key from Vercel env |
| Push notifications not arriving | Customer hasn't enabled them in profile | Customer must visit `/customer/profile` and tap Enable Notifications first |
| Lobstr won't connect to anchor | TLS or CSP error | Verify `connect-src` in `vercel.json` includes Stellar hosts |

---

## 9. Files reference

| File | Purpose |
|---|---|
| `plan.md` | Mainnet migration plan (untracked, local-only) |
| `documentation.md` | This file |
| `scripts/setup-anchor.mjs` | Anchor keypair generator + friendbot funder |
| `README.md` | Public-facing project readme |
