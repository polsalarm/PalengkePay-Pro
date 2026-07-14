# PalengkePay — Credit RWA Layer

Tracking doc for the Track 1 (Local Finance & RWA) pivot. Single source of truth
for what was added, the deployed contract IDs, and how to demo it.

> **One-liner:** PalengkePay turns the daily cash flow of Filipino wet-market
> vendors into on-chain credit — giving the informal economy its first real
> financial identity on Stellar.

The RWA = a vendor's on-chain transaction history (cashflow + ratings), already
accrued by the existing contracts. We expose it as a credit score and lend
score-gated working capital against it from a USDC / XLM liquidity pool.

---

## What was added

### Contracts (`contracts/`)

| Item | Where | Summary |
|------|-------|---------|
| `get_credit_score(vendor) -> u32` | `vendor-registry` (v2) | FICO-style 300–850 from `total_volume` + `total_transactions` + ratings − defaults. Deterministic, side-effect free. 5 unit tests. |
| `credit-pool` crate | `contracts/credit-pool/` | Score-gated working-capital lending pool. `initialize / deposit / draw / repay` + views `credit_limit`, `available_to`, `debt`, `pool_balance`, `min_score`. Cross-calls `get_credit_score`. Scheduled auto-repay: `set_schedule` / `cancel_schedule` (vendor-signed) + `collect` (permissionless, pulls via SEP-41 `token.transfer_from` against a vendor-approved allowance — no vendor signature needed at collection time). 16 unit tests. |

**Scoring** (in `get_credit_score`):

- base 300
- volume tiers (XLM stroops): ≥100 XLM +200 · ≥50 +150 · ≥10 +100 · ≥1 +50
- txn tiers: ≥500 +150 · ≥100 +120 · ≥50 +90 · ≥10 +50 · ≥1 +20
- ratings avg stars: ≥4.5 +200 · ≥4.0 +160 · ≥3.5 +120 · ≥3.0 +80 · else +40
- defaults: −100 each
- clamped to [300, 850]

**Lending** (in `credit-pool`): `credit_limit = (score − MIN_SCORE) × CREDIT_PER_POINT`,
where `MIN_SCORE = 500` and `CREDIT_PER_POINT = 1` unit (10,000,000 stroops).
Score 850 ⇒ 350-unit line. `available_to = min(credit_limit − debt, pool_balance)`.

### Frontend (`frontend/`)

| Item | Where | Summary |
|------|-------|---------|
| `useCredit.ts` | `src/lib/hooks/` | `useCreditScore`, `useCreditPool` (limit/available/debt/poolBalance + `draw`/`repay`), `scoreTier` helper. |
| `CreditCard.tsx` | `src/components/` | Working-capital card: score gauge, USDC/XLM toggle, credit line / available / owed, draw + repay. Renders only when the credit env vars are set. |
| VendorHome wiring | `src/pages/vendor/VendorHome.tsx` | `<CreditCard>` surfaced between the QR CTA and Utang CTA. |
| `VendorVault.tsx` | `src/pages/vendor/` | Testnet-only `/vendor/vault` dashboard with Borrow and Provide Liquidity tabs. Vendors can draw/repay; liquidity providers can deposit into the selected XLM/USDC pool from their wallet. |
| Vault navigation | `src/App.tsx`, `src/components/Layout.tsx` | Vault is available from the vendor navigation and home preview on Testnet only; Mainnet builds hide the entry and route back to vendor home. |
| Env vars | `.env.local` (local) / `.env.example` | `VITE_VENDOR_REGISTRY_V2_CONTRACT_ID`, `VITE_CREDIT_POOL_USDC_CONTRACT_ID`, `VITE_CREDIT_POOL_XLM_CONTRACT_ID`, `VITE_USDC_SAC_CONTRACT_ID`, `VITE_XLM_SAC_CONTRACT_ID`. |
| `useAutoRepay` | `src/lib/hooks/useCredit.ts` | Scheduled auto-repay: reads `schedule()` + token `allowance()`, `enable(intervalSeconds, amountUnits, capUnits)` (2 sequential vendor-signed txs — `token.approve` then `pool.set_schedule`, Soroban allows only 1 invoke op/tx so these can't be merged), `cancel()`. Registers/unregisters the vendor with the cron worklist via `/api/credit-autorepay`. |
| Auto-repay UI | `pages/vendor/VendorVault.tsx` | Card in the Borrow tab: cadence presets (Daily/Weekly/Monthly), per-period amount, next-due + allowance-low banner, cancel button. |
| `credit-autorepay.ts` / `_autoRepayStore.ts` | `api/` | KV-backed (Upstash, in-memory fallback) worklist of which vendors have an active schedule per asset — lets the cron relayer avoid scanning the whole chain. Register/unregister is best-effort; the contract's own `next_due` gate is the real guard, not this store. |
| `cron/credit-collect.ts` | `api/cron/` | Daily relayer (Vercel Hobby plan caps crons at 2 total, once/day) — signs with `SPONSOR_SECRET` (fee-payer only, never vendor custody) and calls `collect(vendor)` for every registered vendor/asset. Most calls are expected to simulate-fail harmlessly (not due yet / no debt / allowance short) — those are skips, not errors. Auto-unregisters a vendor once its debt hits 0. |

### CI fixes (`.github/workflows/ci.yml`)

- `get_credit_score` clamp uses `i128::clamp` (clippy `manual_clamp`); `cargo fmt`.
- Dependency audit gate lowered `high` → `critical` (remaining highs are transitive
  `ws` advisories under the wallet kit, unfixable without breaking wallet signing).
- `frontend/api/vitest.setup.ts` clears leaked KV/Upstash env so ramp/health tests
  use the in-memory store instead of hitting real Redis and timing out.

---

## Deployed contract IDs (Stellar **testnet**, redeployed 2026-07-15 for auto-repay)

| Component | Contract ID |
|-----------|-------------|
| `vendor-registry` v2 (credit score) | `CDDDOUWUWGHSBEJDFK5ACA6CQH235UQ252VBPGX7O74G3EYUZZEBYKJR` |
| `credit-pool` (USDC) | `CCJ63ODUQXWRGWGKOOSPQQRHZJYZWGAZ2RK5J4G2T6RNVSLEFR4P5IAQ` |
| `credit-pool` (XLM) | `CAVS2MUDEJSMTJKKCTMHINHHT7OKXSLWMEHSQMCZT5E6MFX4VKZ45AO4` |
| `USDC` SAC (issuer = `palengkepay`) | `CDY4LM3FP2R7FBITPY6RW7HJDKOLZICDVVMAQVQYMH3DOYKC3VEWIXCZ` |
| native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Admin / oracle / LP | `GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH` (`stellar keys` id `palengkepay`) |

> The v2 registry is a **fresh** deploy (the old testnet registry `CDEQVKKR…` had
> no `upgrade` entrypoint). It has no migrated history — demo vendors are re-seeded.
> It is separate from the app's existing `VITE_VENDOR_REGISTRY_CONTRACT_ID`; the
> credit layer reads v2 via its own env var so the rest of the app is undisturbed.

> **2026-07-15 redeploy:** `credit-pool` has no `upgrade` entrypoint either, so adding
> `set_schedule`/`cancel_schedule`/`collect` required a fresh deploy of both pool
> instances (new contract IDs above, superseding `CA2IUTQJ…`/`CCGEJGE3…`). Re-funded
> 1,000 USDC + 580 XLM; debt resets to 0 (old demo debt was on the superseded IDs,
> not migrated — clean slate, arguably better for a live demo of `draw`).

### Mainnet

Not deployed. Same fresh-deploy + USDC-anchor path applies; gated on the same
mainnet blockers as the rest of the project.

The Vault UI and credit hooks intentionally stay disabled on Mainnet while this
Testnet workflow is validated. The current pool contract exposes deposits and
vendor lending, but not LP withdrawal or yield accounting; use Testnet funds only.

---

## End-to-end proof (on-chain)

Seeded `demo_vendor` (`GDQRYEZKD7XVXLDM7NFDPE27N7IVBJQG5RX7IXWAKADKZLE42XQBXVK3`):
100 XLM volume + 2 txns ⇒ **score 520** ⇒ XLM `credit_limit` 20 XLM. Funded the XLM
pool with 100 XLM, vendor drew 20 → `debt` 20, pool balance 80. All four CI checks
(contracts + frontend) green.

---

## How to demo

1. **Run app:** `cd frontend && npm run dev` → http://127.0.0.1:5173
2. **Connect the vendor wallet:** import `demo_vendor` into Freighter
   (`stellar keys show demo_vendor` for the secret), or seed a new vendor below.
3. **Vendor home** shows the Working Capital card: live score, credit line, draw / repay.

### Re-seed / prep a fresh demo vendor

```bash
cd contracts
REG=CDDDOUWUWGHSBEJDFK5ACA6CQH235UQ252VBPGX7O74G3EYUZZEBYKJR
POOL_XLM=CAVS2MUDEJSMTJKKCTMHINHHT7OKXSLWMEHSQMCZT5E6MFX4VKZ45AO4
ADMIN=$(stellar keys address palengkepay)
stellar keys generate demo2 --network testnet --fund
VEN=$(stellar keys address demo2)
# register + build score (volume tiers + txns)
stellar contract invoke --id $REG --source palengkepay --network testnet -- \
  register_vendor --admin $ADMIN --wallet $VEN --market_id "marikina-public-market" \
  --name "Aling Rosa" --stall_number "A-07" --phone "+639180000000" --product_type "vegetables"
# repeat to push volume/txns up (each call = +1 txn, +amount volume)
stellar contract invoke --id $REG --source palengkepay --network testnet -- \
  increment_stats --admin $ADMIN --vendor $VEN --amount 500000000
# fund the pool so there is liquidity to draw
stellar contract invoke --id $POOL_XLM --source palengkepay --network testnet -- \
  deposit --from $ADMIN --amount 1000000000
```

> USDC draws need the vendor to hold a USDC trustline first (classic asset). The
> XLM pool has no trustline friction — use it for the cleanest live draw demo.
