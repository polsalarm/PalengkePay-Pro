# Deployment

## Environments

- Network: `testnet`.
- Frontend deploy target: Vercel static + serverless handlers.

## Local Commands

- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- `npm run qa:visual`
- `cargo test --workspace`, `cargo fmt --all -- --check`, `cargo clippy --workspace -- -D warnings`

## Runtime Variables

See `frontend/.env.example` for required and optional values.
Server-only secrets must remain only in Vercel env configuration, never in repo.

## Known Deployment Checklist

- Confirm Vercel envs and build settings.
- Run smoke on deployment URL and `/api/health`.
- Confirm live parity with latest code before claiming deployed status.
