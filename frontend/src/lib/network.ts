import { Networks } from '@stellar/stellar-sdk';

// Central network config. Single source of truth for testnet vs mainnet.
// All Stellar tx signing / submission / contract calls must import NETWORK_PASSPHRASE from here,
// NOT use Networks.TESTNET / Networks.PUBLIC directly. Flipping to mainnet = 1 env var.

const RAW_NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? 'testnet').toLowerCase();

export type Network = 'testnet' | 'mainnet';
export const NETWORK: Network =
  RAW_NETWORK === 'mainnet' || RAW_NETWORK === 'public' ? 'mainnet' : 'testnet';
export const IS_MAINNET = NETWORK === 'mainnet';

export const NETWORK_PASSPHRASE = IS_MAINNET ? Networks.PUBLIC : Networks.TESTNET;

export const HORIZON_URL =
  (import.meta.env.VITE_HORIZON_URL as string | undefined) ??
  (IS_MAINNET ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');

export const RPC_URL =
  (import.meta.env.VITE_SOROBAN_RPC_URL as string | undefined) ??
  (IS_MAINNET ? 'https://mainnet.sorobanrpc.com' : 'https://soroban-testnet.stellar.org');

export const STELLAR_EXPERT_BASE = IS_MAINNET
  ? 'https://stellar.expert/explorer/public'
  : 'https://stellar.expert/explorer/testnet';
