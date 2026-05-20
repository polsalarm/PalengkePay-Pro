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

