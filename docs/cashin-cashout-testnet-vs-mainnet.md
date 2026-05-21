# Cash-In / Cash-Out: Testnet Flow vs. Mainnet Gap

PalengkePay's fiat ramp routes PHP ↔ XLM through a PDAX-style anchor. On testnet the entire flow is **mock-simulated** end-to-end; on mainnet the same code paths exist but are intentionally gated off because production credentials, legal contracts, and KMS-signed custody are not in place.

This document explains exactly what runs in each environment, where the seams are, and what must change before mainnet can clear real PHP.

---

## 1. Where the code lives

| Layer | File | Role |
| --- | --- | --- |
| HTTP dispatcher | `frontend/api/ramp.ts` | `/api/ramp/{cashin,cashout,status,admin}` consolidated handler (Vercel Hobby 12-function cap → `_op` query rewrite) |
| PDAX client | `frontend/api/_pdax.ts` | REST client with HMAC SHA-384 auth + mock fixture branch |
| Stellar anchor | `frontend/api/_anchor.ts` | Custody account signing + Horizon submission |
| State store | `frontend/api/_rampStore.ts` | Upstash Redis (prod) / in-memory (dev fallback) |
| Profile resolver | `frontend/api/liquidity-profile.ts` | Decides `testnet` vs `mainnet`, `mock` vs `partner_api` rail mode |
| Mainnet gate | `liquidity-profile.ts → getMainnetReadiness()` | Health check that blocks live fiat unless every prod precondition is met |
| Frontend client | `frontend/src/lib/ramp.ts` | `createCashout`, `quoteCashin`, `confirmCashin`, status polling |

Vercel rewrites in `frontend/vercel.json` map the friendly paths (`/api/ramp/cashin`) to the dispatcher with the right `_op` query.

---

## 2. The mode switches

Two layered switches decide whether the ramp is mock or live.

### 2.1 Network profile (`ANCHOR_NETWORK_PROFILE`)

`liquidity-profile.ts → profileFromEnv()`:

| Env value | Profile | Network |
| --- | --- | --- |
| unset / `testnet` | `testnet` | testnet |
| `mainnet-ready` | `mainnet-ready` | mainnet |
| `mainnet` | `mainnet` | mainnet |

### 2.2 Rail mode (`modeFor(profile)`)

```ts
if (profile === 'testnet') return 'mock';
if (canUsePartnerApi()) return 'partner_api';
return 'manual_operator';

function canUsePartnerApi(): boolean {
  return !boolEnv('PDAX_MOCK') && Boolean(env('PDAX_API_KEY') && env('PDAX_API_SECRET'));
}
```

So:

- **Testnet** is always `mock`, regardless of whether PDAX creds exist.
- **`mainnet-ready` / `mainnet`** becomes `partner_api` only when **all of** `PDAX_API_KEY`, `PDAX_API_SECRET`, and `PDAX_MOCK !== 'true'` are present. Otherwise it falls back to `manual_operator` (operator settles PHP off-chain by hand).

Independently, `_pdax.ts` has its own kill switch:

```ts
const MOCK = process.env.PDAX_MOCK === 'true' || !API_KEY || !API_SECRET;
```

If `MOCK` is true, every `call()` short-circuits into `mock()` — no outbound request to `api.pdax.ph`. The two switches are deliberately redundant so a misconfigured testnet deploy cannot accidentally call live PDAX.

### 2.3 Live fiat gate (`liveFiatClaimsEnabled`)

```ts
liveFiatClaimsEnabled = profile === 'mainnet' && railMode === 'partner_api';
```

Even `mainnet-ready` does **not** clear `liveFiatClaimsEnabled`. The frontend reads this flag to decide whether to render real-money UI vs. demo banners.

---

## 3. Testnet flow — what actually happens

Production Vercel environment (`palengkepay-pro`) currently has:

- `PDAX_API_KEY`, `PDAX_API_SECRET` — **not set**
- `PDAX_MOCK` — present (sensitive)
- `ANCHOR_NETWORK_PROFILE` — not set → defaults to `testnet`
- `ANCHOR_SIGNING_SECRET`, `ANCHOR_HORIZON_URL`, etc. — set (testnet anchor account funded)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — set (Upstash Redis for state persistence across cold starts)

Result: `railMode='mock'`, `network='testnet'`, `MOCK=true` in `_pdax.ts`.

### 3.1 Cash-in (PHP → XLM) on testnet

Client → `POST /api/ramp/cashin?action=quote { wallet, amountPhp }`

1. `ramp.ts::cashin('quote')` calls `quoteCashin({ amountPhp, asset: 'XLM' })`.
2. `_pdax.ts::quoteCashin` hits `mock('POST', '/cashin/quote')`:
   ```ts
   assetAmount = amountPhp / RAMP_RATE_FALLBACK   // default 7.85
   rate        = '7.85'
   expiresAt   = now + 60_000
   ```
3. `quoteWithLiquidityMetadata` stamps the quote with `feePhp`, `spreadBps`, `railProvider='PDAX_STYLE'`, `railMode='mock'`, and a `proofReference` like `RMP-MPFX…`.
4. `createTxn` persists a `kind: 'deposit'` row in Upstash with `status: 'incomplete'`, `providerStatus: 'simulated_quote_locked'`.
5. Response is returned to the client (`amountPhp`, `amountXlm`, `rate`, `proofReference`, `expiresAt`, GCash/QR Ph instructions).

Client → `POST /api/ramp/cashin?action=confirm { id, reference }`

6. Customer claims they sent PHP off-platform (GCash, etc.).
7. Txn moves to `status: 'pending_external'`, `providerStatus: 'user_claimed_fiat_sent'`.
8. Hidden admin UI (`/api/ramp/admin`) lets the operator either `release_xlm` or `fail`.

Admin → `POST /api/ramp/admin?action=release_xlm { id }`

9. `_pdax.ts::withdrawCrypto` is the mock branch, but it has a **real-on-testnet** escape hatch:
   ```ts
   if (p.asset === 'XLM' && isAnchorConfigured()) {
     const result = await sendPayment(p.address, p.amount, p.memo);
     return { id: result.hash, status: 'COMPLETED', stellarTxHash: result.hash };
   }
   ```
10. `_anchor.ts::sendPayment` builds and submits an actual Stellar testnet payment from `ANCHOR_SIGNING_SECRET`'s account. The customer wallet receives real testnet XLM with a memo equal to the ramp id.
11. Txn → `status: 'completed'`. A web-push fanout fires to the customer.

So testnet cash-in is mock on the PHP side (no money moved) but **real** on the XLM side (testnet ledger).

### 3.2 Cash-out (XLM → PHP) on testnet

Client → `POST /api/ramp/cashout?action=create { wallet, amountXlm, rail, destination }`

1. `ramp.ts::cashout('create')` validates the G… wallet + rail.
2. `createTxn` stores a `kind: 'withdraw'` row, `status: 'pending_user_transfer_start'`.
3. `_pdax.ts::getDepositAddress` returns the anchor account public key + memo = ramp id. (In real PDAX this would be PDAX's custody address; here the anchor *is* the custodian.)
4. Response: `{ depositAddress, memo, memoType: 'TEXT', … }`. Frontend prompts the user to send XLM there.

User signs an XLM payment to the anchor with that memo. Hash returned to the client.

Client → `POST /api/ramp/cashout?action=settle { id, stellarTxHash }`

5. `_anchor.ts::verifyIncomingPayment` (if anchor configured) checks Horizon: the tx hash exists, memo matches the ramp id, asset is native, amount ≥ expected. Mismatch → `status='error'` and a 400 to the client.
6. Mock PDAX SELL order is placed: `placeOrder({ market: 'XLM-PHPT', side: 'SELL', amount })` returns `filledAmount × averagePrice` = PHP amount (using `RAMP_RATE_FALLBACK`).
7. `requestCashout` is the mock branch → returns `status: 'PENDING'`, `reference: 'PP<timestamp>'`. **No PHP leaves any real account.**
8. Txn → `status: 'pending_external'`, `providerStatus: 'PENDING'`, `message: 'Awaiting operator to mark PHP sent'`.

Admin → `POST /api/ramp/admin?action=mark_php_sent { id, reason }`

9. Operator manually confirms (out-of-band) that they ePHP'd the customer through their own GCash/InstaPay account.
10. Txn → `status: 'completed'`, `providerStatus: 'operator_confirmed_fiat_sent'`. Push notification fires.

Testnet cash-out is **real on the XLM side** (Horizon verification of the inbound payment) and **simulated on the PHP side** (no money moves; operator decides whether to actually pay the user out-of-band, e.g., to settle a hackathon demo).

### 3.3 State persistence

`_rampStore.ts` writes through to Upstash Redis with two indexes:

- `pp:ramp:{id}` — full JSON blob per transaction
- `pp:ramp:wallet:{wallet}` — set of ids for customer history
- `pp:ramp:pending` — set of ids the admin UI polls

In-memory fallback exists for cold dev runs but is **not** used on Vercel because `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set. State survives cold starts, so a quote at 09:00 can be confirmed by an admin at 12:00.

---

## 4. Why mainnet does not work

The path from testnet to mainnet is gated by `getMainnetReadiness()` in `liquidity-profile.ts`. Until every check below passes, the frontend will not flip `liveFiatClaimsEnabled=true`, and the rail will silently fall back to `manual_operator`. Most of these gates fail today.

### 4.1 Missing infrastructure

| Required env / fact | Why it matters |
| --- | --- |
| `ANCHOR_NETWORK_PROFILE=mainnet` | Switches `network`, passphrase, Horizon URL to public Stellar |
| `ANCHOR_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"` | `getMainnetReadiness` explicitly checks this matches `MAINNET_PASSPHRASE` |
| `ANCHOR_HORIZON_URL = https://horizon.stellar.org` | Required by anchor + verification |
| `SOROBAN_RPC_URL` (mainnet) | Currently defaults to empty for mainnet — must be set |
| `VITE_VENDOR_REGISTRY_CONTRACT_ID` / `VITE_PALENGKE_PAYMENT_CONTRACT_ID` / `VITE_UTANG_ESCROW_CONTRACT_ID` | Soroban contracts must be re-deployed on mainnet and the IDs swapped in |
| `ANCHOR_SIGNING_SECRET` | Mainnet custody account. **Cannot ship as a plain env var** — see §4.2 |
| `PDAX_API_KEY`, `PDAX_API_SECRET`, `PDAX_MOCK=false` | Required to flip `canUsePartnerApi() = true` so `railMode='partner_api'` |
| `RAMP_ADMIN_KEY` | Admin operator auth (already set, but must be rotated for prod) |
| `RAMP_WEBHOOK_SECRET` | PDAX webhook signature verification (not implemented yet) |
| `FEE_BUMP_ALLOWED_DESTINATIONS` | Sponsor-data fee-bump allowlist for mainnet |
| `FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT=true` | Cannot ship sponsor data on mainnet without durable rate limit |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Already satisfied |

`getMainnetReadiness` returns a single 503 with a comma-separated `missing:` list if any of these are absent. The frontend reads that and refuses to render live-fiat UI.

### 4.2 The custody / KMS problem

`_anchor.ts` reads the **plaintext private key** from `ANCHOR_SIGNING_SECRET` and signs every payment server-side:

```ts
const SIGNING_SECRET = process.env.ANCHOR_SIGNING_SECRET;
…
cachedKp = Keypair.fromSecret(SIGNING_SECRET);
```

The header comment is explicit:

> Hackathon-grade: operator funds the anchor account on testnet and the server signs payments directly. **For mainnet this must move to a HSM/KMS.**

On mainnet that secret would hold real customer XLM. Anyone with Vercel project access (or any future env-leak vector) would be able to drain the account. Mainnet requires:

- AWS KMS / GCP KMS / Hashicorp Vault Transit signing
- Soroban smart accounts with passkey/WebAuthn signers (preferred — keeps signing off the server entirely)
- At minimum, a multi-sig anchor account with one signer offline

None of this is wired yet.

### 4.3 The fiat liquidity problem

Even with `partner_api` mode enabled, real PDAX integration is incomplete:

- The HMAC SHA-384 client in `_pdax.ts` is built to the public PDAX REST shape but has never been tested against a sandbox. PDAX sandbox access is conditioned on a signed business partnership, KYC review, and a corporate bank account — none of which a hackathon team has.
- `requestCashout` would need to be replaced with a real PSP integration (GCash Business, QR Ph PSP, or PDAX Connect's payout API). The current code only calls `POST /cashout` against a generic PDAX URL.
- Webhook handlers for `pending → sent → completed` state transitions are not implemented; the admin UI assumes operator clicks.
- AML / KYC / travel-rule compliance for fiat off-ramp is a regulatory requirement under the BSP (Bangko Sentral ng Pilipinas) Virtual Asset Service Provider rules. The project has no VASP license.
- Customer KYC: a mainnet ramp can't onboard anonymous wallets. The current SEP-10 anchor authenticates a wallet but does not bind it to a verified PHP identity.

### 4.4 Regulatory and legal blockers

The hackathon-grade design treats the operator as a self-custodial money-mover. In production this is a regulated activity:

- BSP Circular 1108 (VASP) registration with paid-up capital, board approval, AML officer.
- SEC registration if any rewards/yield are exposed.
- DICT data privacy compliance for KYC artifact storage.
- BIR tax reporting (final-tax withholding on transaction fees).
- Settlement banking: any real ramp requires a corporate bank account with explicit BSP approval for VASP settlement flows. Retail bank accounts will be closed.

These are policy gates, not code gates, and no amount of env-var configuration unlocks them.

---

## 5. Local development reality

Vite (`npm run dev`) does not natively serve `/api/*`. Two fixes exist:

- `vercel dev` — full Vercel emulation, honors `vercel.json` rewrites, requires `vercel link`.
- The `vercelApiDevPlugin()` shipped in `frontend/vite.config.ts` — mounts `/api/*` inside the Vite middleware stack, replays the rewrite table, and dispatches the same handlers Vercel would.

Both paths converge on the same testnet mock flow described in §3.

---

## 6. Summary

- **Testnet works** because everything that touches real money is mocked, and everything that touches the ledger uses a testnet anchor key that lives in a Vercel env var. State persists in Upstash. The customer experience is fully end-to-end.
- **Mainnet does not work** because (a) the custody model puts a plaintext signing key in `process.env`, (b) the PDAX/PSP/bank integrations are stubs, (c) the regulatory perimeter (BSP VASP, AML, KYC) is not crossed, and (d) `getMainnetReadiness` will short-circuit live fiat until ~12 distinct env vars and infrastructure pieces are all in place at once.

The intended progression is:

1. `testnet` — current state. Demo + hackathon evaluation.
2. `mainnet-ready` — mainnet contracts deployed, mainnet anchor configured, but `liveFiatClaimsEnabled=false`. Lets the UI render real-network identifiers (wallets, contracts) while still routing fiat through manual operator settlement.
3. `mainnet` with `partner_api` — only after PDAX/PSP contract is signed, KMS-backed custody is wired, and BSP VASP filing is in place.

Steps (2) and (3) are blocked on legal/business work, not code.
