# Verification

## Local Verification (passed)

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run qa:visual`
- `cargo test --workspace`
- `cargo fmt --all -- --check`
- `cargo clippy --workspace -- -D warnings`

## Vercel Build and Deploy Evidence (2026-05-19 / 13:11:37 Asia/Manila)

- `COMSPEC` set to `C:\Windows\System32\cmd.exe`.
- `Get-Command cmd` resolved `C:\WINDOWS\system32\cmd.exe`.
- `NPM_CONFIG_SCRIPT_SHELL` set to `C:\Program Files\Git\bin\bash.exe`.
- `npx vercel@50.42.0 build --yes` passed and generated `.vercel/output`.
- `npx vercel@50.42.0 deploy --prebuilt --no-wait` passed.
- Deployment id: `dpl_HaxVfpXdyDx9zZJdMGmvLYBET57H`
- Preview URL: `https://palengke-p3kymh2dp-iron-marks-projects.vercel.app`
- Inspector: `https://vercel.com/iron-marks-projects/palengke-pay/HaxVfpXdyDx9zZJdMGmvLYBET57H`
- Note: the fresh deployment URL returned Vercel Authentication Protection HTML for `/api/health`, so public route evidence was captured from `https://palengke-pay.vercel.app`.

## Visual and Route Deployment Evidence (2026-05-19 / 13:11:37 Asia/Manila)

- `npm run qa:visual` passed with 46 desktop + 46 mobile tests from local preview build (`frontend/scripts/run-visual-qa.mjs`).
- Run report package: `Stellar-PalengkePay-Pro/docs/verification-packages/deployment-evidence-20260519_055137.zip`
- Deployment route matrix log:
  - Timestamp: `2026-05-18T21:48:33.836Z` to `2026-05-18T21:48:43.722Z` UTC
  - Matrix report: `Stellar-PalengkePay-Pro/frontend/docs/verification-evidence/20260518_214833/route-matrix-log.json`
  - Matrix markdown: `Stellar-PalengkePay-Pro/frontend/docs/verification-evidence/20260518_214833/route-matrix-log.md`
  - Timestamped screenshots: `Stellar-PalengkePay-Pro/frontend/docs/verification-evidence/20260518_214833/route-matrix-screenshots/*.png`
- `/api/health` health check proof:
  - Response: `{"status":"ok","checks":[{"name":"horizon","ok":true,"status":200},{"name":"soroban_rpc","ok":true,"status":200}]}`
  - Fetch endpoint: `https://palengke-pay.vercel.app/api/health`
  - Screenshot artifact: `Stellar-PalengkePay-Pro/frontend/docs/verification-evidence/20260518_214833/route-matrix-screenshots/api-health_fullpage_2026-05-18T21-48-42-412Z.png`
  - API capture: `Stellar-PalengkePay-Pro/frontend/docs/verification-evidence/20260518_214833/api-health-screenshot-log.json`

## Sponsor Durability Env Proof (2026-05-18 / 06:55:01 Asia/Manila)

- Vercel command: `npx vercel@50.42.0 env ls production`
- Vercel project: `iron-marks-projects/palengke-pay`
- Result: no production environment variables found.
- Env proof artifact: `Stellar-PalengkePay-Pro/frontend/docs/verification-evidence/20260518_065453/vercel-production-env-proof.json`
- `/api/health` rerun artifact: `Stellar-PalengkePay-Pro/frontend/docs/verification-evidence/20260518_065453/api-health-env-proof.json`
- `/api/health` rerun status: HTTP `200`
- `/api/health` sponsor readiness visibility: current public response does not include `sponsor_rate_limit`, so sponsor durability is not proven by live health output.
- Missing or unconfirmed production sponsor durability keys:
  - `SPONSOR_SECRET`
  - `FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT`
  - `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL`
  - `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN`

## Spec Status Checklist

- [x] Visual QA pack complete.
- [x] Vercel prebuilt build complete.
- [x] Vercel prebuilt deploy command complete.
- [x] Public route matrix complete.
- [x] `/api/health` screenshot and JSON log complete.
- [x] Evidence package complete.
- [x] Production env proof captured without exposing secret values.
- [ ] Fresh deployment URL public access proof. Blocked by Vercel Authentication Protection on `https://palengke-m02qyqcip-iron-marks-projects.vercel.app`.
- [ ] Wallet-signed chain payment smoke and onchain hash evidence.
- [ ] Vercel secret/env proof for production sponsor durability. Blocked because production env has no sponsor/Redis variables and local files do not contain values Codex can add.
- [ ] Real-device mobile wallet/smoke validation.

## Live Smoke (latest)

- `https://palengke-pay.vercel.app/` and 21 routes (including `/api/health`) returned HTTP 200 in the route matrix.
- `/api/health` returned HTTP 200 with `status:"ok"`.

## Prior Package Comparison

- Prior package: `Stellar-PalengkePay-Pro/docs/verification-packages/deployment-evidence-20260517_221555.zip`
- Current package: `Stellar-PalengkePay-Pro/docs/verification-packages/deployment-evidence-20260519_055137.zip`
- Route matrix stayed green: prior and current runs returned HTTP 200 across all routes captured.
- `/api/health` stayed green: prior `status:"ok"`, current `status:"ok"`.
- Build blocker resolved with `COMSPEC` plus Git Bash script shell for Vercel CLI.



---

## PR #1 Phase 2 Hardening E2E Evidence

Timestamp: 2026-05-20 19:00 Asia/Manila

Branch: `fix/pr-1-phase2-hardening`

Scope:

- Harden PR #1 Phase 2 push-notification serverless endpoints.
- Complete PHP/XLM display-unit and privacy-mask coverage on the main customer and vendor Phase 2 surfaces.
- Verify local build, targeted lint, browser route rendering, and local API negative-path behavior.

Evidence artifacts:

- Route matrix: `frontend/docs/verification-evidence/20260520_190047-pr1-phase2-hardening/route-matrix.md`
- Route screenshots: `frontend/docs/verification-evidence/20260520_190047-pr1-phase2-hardening/*.png`
- API probes: `frontend/docs/verification-evidence/20260520_190047-pr1-phase2-hardening/api-negative-probes.md`
- JSON logs: `frontend/docs/verification-evidence/20260520_190047-pr1-phase2-hardening/route-matrix.json`, `frontend/docs/verification-evidence/20260520_190047-pr1-phase2-hardening/api-negative-probes.json`

Verification results:

| Check | Command / Method | Result |
|---|---|---|
| Production frontend build | `npm run build` in `frontend/` | PASS |
| Targeted lint for touched Phase 2 files | `npx eslint ...` | PASS |
| Desktop route matrix | Playwright Chromium against `http://127.0.0.1:4174` | 12/12 PASS |
| Mobile route matrix | Playwright Chromium Pixel 5 viewport against `http://127.0.0.1:4174` | 12/12 PASS |
| Push API negative-path probes | Direct Vercel handler harness via `tsx` | 9/9 PASS |

Routes covered:

- `/`
- `/connect`
- `/customer/home`
- `/customer/profile`
- `/customer/scan`
- `/customer/utang`
- `/customer/history`
- `/vendor/home`
- `/vendor/profile`
- `/vendor/utang`
- `/vendor/transactions`
- `/market`

API behavior covered:

- `push-subscribe` rejects non-POST requests.
- `push-subscribe` rejects registration when VAPID keys are missing.
- `push-subscribe` rejects invalid wallet IDs.
- `push-subscribe` rejects malformed subscriptions.
- `push-notify` rejects non-POST requests.
- `push-notify` rejects invalid wallet IDs.
- `push-send` rejects non-POST requests.
- `push-send` rejects malformed subscriptions before VAPID initialization.
- Production cron rejects execution when `CRON_SECRET` is missing.

Residual limits:

- Real push delivery was not fully exercised because it requires browser notification permission plus valid VAPID keys.
- Durable Redis/KV persistence was not fully exercised because production KV credentials were not used.
- Wallet-signed payment and utang on-chain flows were not exercised because no connected wallet session was available for signing.
- Full `npm run lint` still fails on pre-existing repo-wide React compiler lint debt outside this PR hardening scope.

---

## Testnet Liquidity Rail Production Beta Checkpoint

Timestamp: 2026-05-21 06:58 Asia/Manila

Branch: `main`

Commit under test: `0067529 feat(liquidity): add testnet-first rail readiness`

Production beta URL:

- `https://palengke-pay-beta.vercel.app`

Deployment evidence:

- Vercel project root directory was set to `frontend`.
- Latest production deployment inspected as Ready:
  - Deployment URL: `https://palengke-3n6fb7rle-iron-marks-projects.vercel.app`
  - Deployment id: `dpl_3hDCdJnyDUgURH8DvGXwuXkKcTPB`
  - Aliased to `https://palengke-pay-beta.vercel.app`
- Production environment variables added without exposing values:
  - `ANCHOR_NETWORK_PROFILE`
  - `PDAX_MOCK`
  - `RAMP_RATE_FALLBACK`
  - `RAMP_FEE_PERCENT`
  - `RAMP_SPREAD_BPS`
  - `RAMP_ADMIN_KEY`

Local verification before production redeploy:

| Check | Result |
|---|---|
| `npm test` | PASS, 15 files / 70 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run qa:visual` | PASS, 46 desktop + 46 mobile checks |
| Local Vercel route smoke | PASS for `/customer/cashin`, `/customer/cashout`, `/admin/ramps`, `/admin/health`, `/.well-known/stellar.toml`, `/api/sep24/info` |
| Direct handler ramp lifecycle | PASS for cash-in quote/confirm/admin release and cash-out create/settle/admin complete |

Production beta route smoke:

| Route | Result |
|---|---|
| `/.well-known/stellar.toml` | HTTP 200, Testnet Stellar TOML served |
| `/api/sep24/info` | HTTP 200 |
| `/customer/cashin` | HTTP 200 |
| `/customer/cashout` | HTTP 200 |
| `/admin/ramps` | HTTP 200 |
| `/admin/health` | HTTP 200 |
| `/api/ramp/admin` without key | HTTP 401 |
| `/api/ramp/admin` with generated production key | HTTP 200 |
| `/api/health` | HTTP 503 degraded, expected until durable Redis/KV is configured |

Production beta ramp E2E:

| Flow | Evidence | Result |
|---|---|---|
| Cash-in quote | Generated PDAX-style quote with `railMode=mock`, fee, spread, and proof reference | PASS |
| Cash-in confirm | Customer proof claim moved transaction to `pending_external` | PASS |
| Admin queue | Cash-in transaction appeared in admin queue | PASS |
| Admin release XLM | Operator release moved transaction to `pending_stellar`; provider status `PENDING` because `ANCHOR_SIGNING_SECRET` is not configured | PASS with known Testnet custody blocker |
| Cash-out create | Created mock provider cash-out request with Testnet network metadata and deposit address | PASS |
| Cash-out settle | Mock Stellar hash moved transaction to `pending_external` with calculated PHP amount | PASS |
| Admin mark PHP sent | Operator completed payout and final status became `completed` | PASS |
| Cash-out receipt timeline | Final status lookup showed 5 settlement events | PASS |

Current production beta health:

```json
{
  "status": "degraded",
  "networkProfile": {
    "profile": "testnet",
    "network": "testnet",
    "railProvider": "PDAX_STYLE",
    "railMode": "mock",
    "liveFiatClaimsEnabled": false
  },
  "failingCheck": {
    "name": "sponsor_rate_limit",
    "detail": "durable Redis REST rate limiting is required"
  }
}
```

Residual blockers:

- Durable Redis/KV production rate limiting is not configured. Required: `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` plus `KV_REST_API_TOKEN`.
- Real Testnet XLM release from the anchor is not enabled until `ANCHOR_SIGNING_SECRET` is configured and funded.
- Mainnet activation remains blocked until production custody, provider credentials, webhook secrets, rate limits, and go/no-go checks are present.
- `https://palengke-pay.vercel.app` is still attached to another deployment/project. Attempting to alias the latest deployment returned: `The chosen alias "palengke-pay.vercel.app" is already in use.`

Demo recommendation:

- Use `https://palengke-pay-beta.vercel.app` for the hackathon demo unless the stale `palengke-pay.vercel.app` alias is freed or transferred.

---

## Stronger Liquidity Product Features Local Verification

Timestamp: 2026-05-21 08:26 Asia/Manila

Scope:

- QR Ph-style payment instruction card for cash-in quotes.
- Rate/fee simulator backed by the non-persistent cash-in preview quote.
- Operator CSV/JSON audit export and seed-only demo data action.
- Customer Testnet wallet check route with Stellar Expert proof link.

Verification results:

| Check | Result |
|---|---|
| `npm test` | PASS, 18 files / 79 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run qa:visual` | PASS, 46 desktop + 46 mobile checks |
| Static route smoke | PASS for `/customer/cashin`, `/customer/cashout`, `/customer/testnet-wallet`, `/admin/ramps` |

API coverage:

- `cashin?action=preview` returns quote metadata without creating a ramp record.
- Admin export rejects missing admin key.
- Admin JSON export returns active-network records only.
- Admin CSV export returns `text/csv` with the audit header.
- Admin seed demo action appends four representative records without deleting existing records.

Residual limits:

- `vercel dev` could not be used from the linked frontend folder because Vercel project root is configured as `frontend`, which makes local CLI execution look for `frontend/frontend`. API behavior is covered by direct handler tests instead.
- Real wallet signing on `/customer/testnet-wallet` still requires an actual connected Testnet wallet.
- Durable KV/Redis is still required for production persistence across serverless instances.
