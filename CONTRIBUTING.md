# Contributing to PalengkePay

Thanks for helping improve PalengkePay. This project is a Stellar Testnet PWA with a React/Vite frontend and Soroban smart contracts.

## Project Setup

Prerequisites:

- Node.js 20+
- npm
- Rust stable toolchain
- Stellar CLI for contract deployment work

Install and run the frontend:

```powershell
cd frontend
npm ci --legacy-peer-deps
npm run dev
```

Run contract tests:

```powershell
cd contracts
cargo test --workspace
```

## Environment

Create `frontend/.env.local` from `frontend/.env.example` and fill in Testnet contract IDs.

Do not commit secrets. Keep server-only values such as `SPONSOR_SECRET` in Vercel or another deployment secret store.

## Quality Gates

Run these before opening a pull request:

```powershell
cd frontend
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run qa:visual
```

```powershell
cd contracts
cargo test --workspace
```

If a command cannot run locally because of missing tooling, document the exact blocker in the pull request.

## Good First Issues

Good first contributions should be small and easy to verify:

- Improve empty, loading, or error states in one route.
- Add route-level Playwright smoke coverage.
- Improve docs clarity without changing product claims.
- Add focused tests for fee-bump, quote, payment history, or metrics helpers.

## Pull Request Checklist

- Explain the user-visible change or maintenance goal.
- Link the issue or describe the problem.
- Include screenshots for UI changes.
- List commands run and their results.
- Avoid broad refactors mixed with feature or bug-fix work.
- Do not include raw wallet secrets, sponsor keys, private keys, or `.env.local`.
