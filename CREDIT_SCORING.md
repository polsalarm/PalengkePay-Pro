# PalengkePay — Credit Scoring Rules

How `VendorRegistry::get_credit_score` computes a vendor's 300–850 score, and how
`CreditPool` turns that score into a real credit line. Both are deterministic, on-chain,
side-effect-free view functions — same inputs always produce the same score, no hidden
state, nothing an admin can quietly thumb the scale on (multisig-gated writes only — see
`contracts/README.md`).

Source: `contracts/vendor-registry/src/lib.rs` (`get_credit_score`), `contracts/credit-pool/src/lib.rs`.

---

## The score: 300–850, FICO-style

Every vendor starts at a **300 floor**. Four factors add to or subtract from it, then the
result is clamped back into `[300, 850]`.

### 1. Cashflow volume — `total_volume` (XLM stroops, 1 XLM = 10,000,000 stroops)

| Total volume moved | Points |
|---|---:|
| ≥ 100 XLM (1,000,000,000 stroops) | +200 |
| ≥ 50 XLM (500,000,000 stroops) | +150 |
| ≥ 10 XLM (100,000,000 stroops) | +100 |
| ≥ 1 XLM (10,000,000 stroops) | +50 |
| below that | +0 |

### 2. Activity — `total_transactions`

| Transaction count | Points |
|---|---:|
| ≥ 500 | +150 |
| ≥ 100 | +120 |
| ≥ 50 | +90 |
| ≥ 10 | +50 |
| ≥ 1 | +20 |
| 0 | +0 |

### 3. Reputation — average star rating (`RatingSum` / `RatingCount`)

Average is computed ×100 to stay integer (avoids fixed-point/float on-chain).

| Average stars | Points |
|---|---:|
| ≥ 4.5 | +200 |
| ≥ 4.0 | +160 |
| ≥ 3.5 | +120 |
| ≥ 3.0 | +80 |
| below 3.0 | +40 |
| no ratings yet | +0 (skipped entirely) |

### 4. Defaults — `VendorDefaultsReceived`

**−100 points per defaulted utang**, no cap other than the final 300 floor. This is the
only factor that can pull a score down once earned.

### Where the numbers come from

Both `total_volume`/`total_transactions` and `VendorDefaultsReceived` are fed by
**permissionless, pull-based** functions — `record_activity_from_payment(payment_id)`,
`record_activity_from_installment(utang_id)`, `record_default_from_utang(utang_id)` — that
cross-contract-read the already-settled record straight off the live
`palengke-payment`/`utang-escrow` contracts, deduped by ID. No one signs off on a vendor's
numbers; the numbers just mirror what already happened on-chain. The old admin-gated
`increment_stats`/`report_default` still exist as a manual-override/dispute path, but they
now require 2-of-3 multisig sign-off, not a single key. Full governance rationale in
`contracts/README.md` under "Credit Score Oracle Fix".

### Tiers (frontend display only — not stored on-chain)

| Score | Tier |
|---|---|
| 750–850 | Excellent |
| 670–749 | Good |
| 580–669 | Fair |
| 301–579 | Building |
| 300 | No credit yet |

(`frontend/src/lib/hooks/useCredit.ts` → `scoreTier()`)

---

## From score to credit line: `CreditPool`

```
CREDIT_PER_POINT = 10,000,000 (1 unit of the pool's asset, 7-decimal — 1 USDC or 1 XLM)
MIN_SCORE         = 500 (default; admin-tunable via set_min_score)

credit_limit(vendor) = score <= MIN_SCORE ? 0 : (score - MIN_SCORE) × CREDIT_PER_POINT
available_to(vendor) = min(credit_limit - debt, pool_balance)
```

At the ceiling — score 850 — that's `(850 - 500) × 1 = 350` units of credit (350 USDC or
350 XLM, whichever pool). A vendor at or below 500 has no line at all: below the floor,
they're still loan-shark territory, not PalengkePay's problem to solve yet.

`available_to` is additionally capped by whatever liquidity LPs have actually deposited —
a vendor can be mathematically entitled to 350 USDC and still only draw what the pool
holds. Two pool instances exist per registry (one USDC, one native XLM); a vendor's score
is the same either way, only the settlement asset differs.

---

## Worked example (real mainnet vendor, verified on-chain 2026-07-24)

Vendor `GD42AJ...HNKO` ("Daine Fishball", stall C-9), real `get_vendor` state after the
mainnet activity backfill:

- `total_volume` = 5,145,473 stroops (~0.51 XLM) → below the 1 XLM / 10,000,000-stroop
  tier → **+0**
- `total_transactions` = 5 → ≥1 tier → **+20**
- Ratings: `get_vendor_rating` → sum 10 / count 2 → average 5.0★ (avg_x100 = 500) →
  ≥4.5 tier → **+200**
- Defaults: 0 → **−0**

`300 + 0 + 20 + 200 − 0 = 520` — matches the real `get_credit_score` call exactly. Score
520 sits in the "Building" tier (580 is the next tier up, "Fair"), and at MIN_SCORE 500
gives this vendor `(520 − 500) × 1 = 20` units of credit line (20 XLM or 20 USDC,
whichever pool).

Always read `get_credit_score` on-chain for a vendor's actual live score rather than
hand-computing it — the source in `vendor-registry/src/lib.rs` is the only ground truth,
and it's easy to forget a factor (ratings, in this case) when estimating by eye.
