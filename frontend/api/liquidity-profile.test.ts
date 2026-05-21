import { afterEach, describe, expect, it } from 'vitest';
import {
  getLiquidityProfile,
  getMainnetReadiness,
  quoteWithLiquidityMetadata,
  resetLiquidityProfileForTests,
} from './liquidity-profile.js';

afterEach(() => {
  resetLiquidityProfileForTests();
  delete process.env.ANCHOR_NETWORK_PROFILE;
  delete process.env.ANCHOR_NETWORK_PASSPHRASE;
  delete process.env.ANCHOR_HORIZON_URL;
  delete process.env.SOROBAN_RPC_URL;
  delete process.env.VITE_VENDOR_REGISTRY_CONTRACT_ID;
  delete process.env.VITE_PALENGKE_PAYMENT_CONTRACT_ID;
  delete process.env.VITE_UTANG_ESCROW_CONTRACT_ID;
  delete process.env.ANCHOR_SIGNING_SECRET;
  delete process.env.PDAX_MOCK;
  delete process.env.PDAX_API_KEY;
  delete process.env.PDAX_API_SECRET;
  delete process.env.RAMP_ADMIN_KEY;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.RAMP_WEBHOOK_SECRET;
  delete process.env.FEE_BUMP_ALLOWED_DESTINATIONS;
  delete process.env.FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT;
});

describe('getLiquidityProfile', () => {
  it('defaults to a testnet mock rail profile', () => {
    expect(getLiquidityProfile()).toMatchObject({
      network: 'testnet',
      networkPassphrase: 'Test SDF Network ; September 2015',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      railProvider: 'PDAX_STYLE',
      railMode: 'mock',
      liveFiatClaimsEnabled: false,
    });
  });

  it('keeps mainnet disabled when provider credentials are missing', () => {
    process.env.ANCHOR_NETWORK_PROFILE = 'mainnet';
    process.env.ANCHOR_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
    process.env.ANCHOR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.SOROBAN_RPC_URL = 'https://mainnet.sorobanrpc.com';

    const profile = getLiquidityProfile();

    expect(profile.network).toBe('mainnet');
    expect(profile.railMode).toBe('manual_operator');
    expect(profile.liveFiatClaimsEnabled).toBe(false);
    expect(profile.warning).toContain('Mainnet partner mode requires production credentials');
  });
});

describe('quoteWithLiquidityMetadata', () => {
  it('adds realistic fee, spread, reference, and expiry metadata', () => {
    const quote = quoteWithLiquidityMetadata({
      id: 'rmp_test123',
      amountPhp: '100.00',
      assetAmount: '12.739',
      providerRate: '7.85',
      nowMs: Date.UTC(2026, 4, 21, 8, 0, 0),
    });

    expect(quote).toMatchObject({
      id: 'rmp_test123',
      amountPhp: '100.00',
      amountXlm: '12.739',
      rate: '7.85',
      feePhp: '2.00',
      spreadBps: 85,
      railProvider: 'PDAX_STYLE',
      railMode: 'mock',
      proofReference: 'RMP-TEST123',
    });
    expect(quote.expiresAt).toBe(Date.UTC(2026, 4, 21, 8, 1, 0));
  });
});

describe('getMainnetReadiness', () => {
  it('reports testnet as safe demo mode', () => {
    expect(getMainnetReadiness()).toMatchObject({
      name: 'liquidity_network_profile',
      ok: true,
      status: 200,
      detail: 'testnet demo mode',
    });
  });

  it('blocks unsafe mainnet activation without custody, provider, and durable env', () => {
    process.env.ANCHOR_NETWORK_PROFILE = 'mainnet';
    process.env.ANCHOR_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
    process.env.ANCHOR_HORIZON_URL = 'https://horizon.stellar.org';

    const readiness = getMainnetReadiness();

    expect(readiness.ok).toBe(false);
    expect(readiness.status).toBe(503);
    expect(readiness.detail).toContain('missing: SOROBAN_RPC_URL');
    expect(readiness.detail).toContain('PDAX_API_KEY');
    expect(JSON.stringify(readiness)).not.toContain('secret');
  });
});
