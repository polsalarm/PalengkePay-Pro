# Operations Readiness

Last updated: 2026-05-14

This runbook defines the operational checks required before claiming PalengkePay is release-ready or production-ready.

## Sponsor Rate Limiting

Fee sponsorship must use durable shared rate limiting in production. Local in-memory limits are acceptable only for development and automated unit tests.

Production fee-bump env:

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPONSOR_SECRET` | Yes | Funded Stellar Testnet sponsor secret. Never expose. |
| `FEE_BUMP_ALLOWED_DESTINATIONS` | Strongly recommended | Comma-separated approved destination accounts. |
| `FEE_BUMP_RATE_LIMIT_WINDOW_MS` | Optional | Window duration. Default: `60000`. |
| `FEE_BUMP_RATE_LIMIT_MAX` | Optional | Max sponsored requests per IP/window. Default: `20`. |
| `FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT` | Yes for production | Set `true` to fail closed when Redis REST env is missing. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Yes for production | Durable Redis REST limiter. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Alternative | Vercel KV REST env names supported as aliases. |

Production readiness rule:

- `/api/fee-bump` must reject sponsor traffic with HTTP `503` when production requires durable rate limiting and Redis REST env is absent.
- `/api/health` must include `sponsor_rate_limit` and report durable Redis REST configured before fee sponsorship can be treated as production-ready.
- Do not print Redis tokens, sponsor secrets, or raw Vercel env values in logs, screenshots, docs, or chat.

## Monitoring Checks

Minimum release monitoring:

- Live `GET /api/health` returns HTTP 200 only when Horizon, Soroban RPC, and sponsor limiter readiness are healthy.
- `/admin/health` renders the health payload and public client env readiness without exposing server secrets.
- Sentry remains optional and enabled only when `VITE_SENTRY_DSN` is configured.
- Vercel project logs should be checked after deployment for fee-bump 429/503 spikes, health degradation, and unexpected API 500s.

Suggested external monitors:

- Uptime check for `/api/health`.
- Alert for repeated `/api/fee-bump` 429 responses.
- Alert for `/api/fee-bump` 503 responses in production.
- Manual sponsor balance check before live demos and after Testnet resets.

## CI Security Gates

GitHub Actions should be green or reviewed before release claims:

- `CI` workflow: frontend tests/typecheck/lint/audit/build/Playwright and contract test/fmt/clippy.
- `Security Scans` workflow: high-confidence secret-pattern scan and CodeQL semantic analysis.

The secret-pattern scan is intentionally conservative and checks for committed high-confidence token shapes. It does not replace provider-side secret scanning or manual review of `.env*`, screenshots, logs, or deployment dashboards.

## Release Evidence Order

1. Run local frontend and contract gates.
2. Confirm `Security Scans` workflow is green or reviewed.
3. Verify Vercel env presence by name/scope only; do not reveal values.
4. Verify live `/api/health` includes healthy `sponsor_rate_limit`.
5. Run wallet-backed Testnet payment smoke and preserve the hash.
6. Verify receipt/history/vendor proof surfaces show the saved hash and locked PHP quote.

## Current Blockers

- Vercel project linking/build proof is not present in this local workspace.
- Real wallet-signed Testnet payment hash still requires manual wallet interaction.
- Real-device mobile wallet testing is still open.
- Mainnet remains blocked until contract audit and production operations proof are complete.
