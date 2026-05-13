# Dependency Audit Notes

Last updated: 2026-05-14

This note records the safe dependency path for the current frontend audit findings.

## Current Result

Run from `frontend`:

```powershell
npm audit --audit-level=high
```

Current status:

- Exit code: `0`
- High and critical advisories: cleared
- Remaining advisories: 3 moderate `ajv` advisories in Vercel tooling and 14 low `elliptic` transitive wallet-chain advisories

The remaining `elliptic` finding is pulled through wallet-related transitive dependencies. `npm audit fix --force` proposes installing `@creit.tech/stellar-wallets-kit@1.5.0`, which is a breaking downgrade from the current 2.x wallet kit line. The remaining `ajv` finding is pinned by `@vercel/static-config`; forcing npm's suggested path would move Vercel tooling to an older major. Do not force either path without a dedicated wallet and Vercel build regression pass.

## Safe Remediation Applied

Direct dependencies were aligned to the current resolved versions:

- `@creit.tech/stellar-wallets-kit@^2.2.0`
- `@stellar/stellar-sdk@^15.1.0`
- `@vercel/node@^5.8.1`

Targeted `overrides` keep vulnerable transitive packages on patched versions while preserving direct package majors:

```json
{
  "axios": "^1.16.1",
  "minimatch": "^10.2.5",
  "path-to-regexp": "^6.3.0",
  "protobufjs": "^7.5.8",
  "smol-toml": "^1.6.1",
  "undici": "^6.25.0"
}
```

## Verification Commands

Run after any dependency movement:

```powershell
cd frontend
npm install
npm audit --audit-level=high
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run qa:visual
```

Optional tree inspection:

```powershell
npm ls '@creit.tech/stellar-wallets-kit' '@stellar/stellar-sdk' '@vercel/node' axios protobufjs undici path-to-regexp minimatch smol-toml
```

Known caveat: this command can exit with `ELSPROBLEMS` because `@trezor/connect-plugin-stellar@9.2.6` declares a peer on `@stellar/stellar-sdk@^13.3.0`, while the app imports and verifies against `@stellar/stellar-sdk@15.x`. Treat that as a wallet peer-compatibility risk to monitor; do not use it as the high/critical audit gate. The audit gate is `npm audit --audit-level=high`.

Run contract checks from `contracts` when preparing a release checkpoint:

```powershell
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
```

## Remaining Risk

- The low-severity `elliptic` advisory remains until upstream wallet/Trezor dependencies ship a compatible fix.
- The moderate `ajv` advisory remains pinned by Vercel static config until Vercel ships a compatible patched dependency path.
- `@trezor/connect-plugin-stellar` still declares a Stellar SDK 13.x peer while the app uses Stellar SDK 15.x. Keep wallet-connect smoke testing in the release checklist until upstream peer ranges catch up.
- The app currently runs under Node 25 in this shell, which produces an engine warning from `@renovatebot/pep440`. CI/deploy should use Node 20/22/24-compatible runtime settings.
- Any future removal of overrides must be paired with a fresh audit and wallet connect/payment smoke test.
