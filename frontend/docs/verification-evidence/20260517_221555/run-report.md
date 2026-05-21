# Deployment Evidence Run Report

Generated: `2026-05-18T06:16:08+08:00`

## Commands

- `Get-Command cmd` resolved `C:\WINDOWS\system32\cmd.exe`.
- `$env:COMSPEC='C:\Windows\System32\cmd.exe'`
- `$env:NPM_CONFIG_SCRIPT_SHELL='C:\Program Files\Git\bin\bash.exe'`
- `npx vercel@50.42.0 build --yes` passed.
- `npx vercel@50.42.0 deploy --prebuilt --no-wait` passed.
- `npm run qa:visual` passed with `46` desktop tests and `46` mobile tests.
- `ROUTE_BASE_URL=https://palengke-pay.vercel.app node scripts/capture-route-matrix.mjs` passed.

## Deployment

- Deployment id: `dpl_As8kUf3meJgCpyKwNmDWWk9vuWpQ`
- Fresh deployment URL: `https://palengke-m02qyqcip-iron-marks-projects.vercel.app`
- Public evidence URL: `https://palengke-pay.vercel.app`
- Inspector: `https://vercel.com/iron-marks-projects/palengke-pay/As8kUf3meJgCpyKwNmDWWk9vuWpQ`

The fresh deployment URL returned Vercel Authentication Protection HTML for `/api/health`, so route matrix and health screenshot evidence were captured from the public production alias.

## Route Matrix

- Routes checked: `23`
- Failed routes: `0`
- Matrix report: `route-matrix-log.json`
- Matrix markdown: `route-matrix-log.md`
- Screenshots: `route-matrix-screenshots/*.png`

## `/api/health`

- Endpoint: `https://palengke-pay.vercel.app/api/health`
- HTTP status: `200`
- Status: `ok`
- Checks:
  - `horizon`: `ok`, HTTP `200`
  - `soroban_rpc`: `ok`, HTTP `200`
- API capture: `api-health-screenshot-log.json`

## Prior Package Comparison

- Prior package: `deployment-evidence-20260517_204524.zip`
- Current package: `deployment-evidence-20260517_221555.zip`
- Route matrix stayed green: prior `23/23`, current `23/23`.
- `/api/health` stayed green: prior `status:"ok"`, current `status:"ok"`.
- Build blocker changed from failing `cmd.exe` spawn to passing with `COMSPEC` plus Git Bash script shell.
