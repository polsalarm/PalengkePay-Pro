import { Networks } from '@stellar/stellar-sdk';

// Server-side mirror of frontend/src/lib/network.ts.
// Reads STELLAR_NETWORK (or VITE_STELLAR_NETWORK passthrough) at request time
// so the SAME api/ functions serve testnet OR mainnet depending on Vercel project env.

function rawNetwork(): string {
  return (process.env.STELLAR_NETWORK ?? process.env.VITE_STELLAR_NETWORK ?? 'testnet').toLowerCase();
}

export type Network = 'testnet' | 'mainnet';

export function getNetwork(): Network {
  const r = rawNetwork();
  return r === 'mainnet' || r === 'public' ? 'mainnet' : 'testnet';
}

export function isMainnet(): boolean {
  return getNetwork() === 'mainnet';
}

export function getNetworkPassphrase(): string {
  return isMainnet() ? Networks.PUBLIC : Networks.TESTNET;
}

export function getHorizonUrl(): string {
  return (
    process.env.HORIZON_URL ??
    process.env.VITE_HORIZON_URL ??
    (isMainnet() ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org')
  );
}

export function getRpcUrl(): string {
  return (
    process.env.SOROBAN_RPC_URL ??
    process.env.VITE_SOROBAN_RPC_URL ??
    (isMainnet() ? 'https://mainnet.sorobanrpc.com' : 'https://soroban-testnet.stellar.org')
  );
}
