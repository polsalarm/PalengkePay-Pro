export type LiquidityNetwork = 'testnet' | 'mainnet';
export type LiquidityNetworkProfile = 'testnet' | 'mainnet-ready' | 'mainnet';
export type RailProvider = 'PDAX_STYLE' | 'PDAX_CONNECT' | 'GCASH_BUSINESS' | 'QRPH_PSP';
export type RailMode = 'mock' | 'manual_operator' | 'partner_api';

export interface LiquidityProfile {
  profile: LiquidityNetworkProfile;
  network: LiquidityNetwork;
  networkPassphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  railProvider: RailProvider;
  railMode: RailMode;
  liveFiatClaimsEnabled: boolean;
  feePercent: number;
  spreadBps: number;
  quoteTtlMs: number;
  warning?: string;
}

export interface LiquidityQuoteMetadata {
  id: string;
  amountPhp: string;
  amountXlm: string;
  rate: string;
  feePhp: string;
  spreadBps: number;
  railProvider: RailProvider;
  railMode: RailMode;
  proofReference: string;
  expiresAt: number;
}

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  status: number;
  detail: string;
}

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function boolEnv(name: string): boolean {
  return env(name).toLowerCase() === 'true';
}

function numberEnv(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function profileFromEnv(): LiquidityNetworkProfile {
  const raw = env('ANCHOR_NETWORK_PROFILE').toLowerCase();
  if (raw === 'mainnet-ready' || raw === 'mainnet') return raw;
  return 'testnet';
}

function providerFromEnv(): RailProvider {
  const raw = env('RAMP_RAIL_PROVIDER').toUpperCase();
  if (raw === 'PDAX_CONNECT' || raw === 'GCASH_BUSINESS' || raw === 'QRPH_PSP') return raw;
  return 'PDAX_STYLE';
}

function canUsePartnerApi(): boolean {
  return !boolEnv('PDAX_MOCK') && Boolean(env('PDAX_API_KEY') && env('PDAX_API_SECRET'));
}

function modeFor(profile: LiquidityNetworkProfile): RailMode {
  if (profile === 'testnet') return 'mock';
  if (canUsePartnerApi()) return 'partner_api';
  return 'manual_operator';
}

export function getLiquidityProfile(): LiquidityProfile {
  const profile = profileFromEnv();
  const mainnetLike = profile === 'mainnet' || profile === 'mainnet-ready';
  const railMode = modeFor(profile);
  const liveFiatClaimsEnabled = profile === 'mainnet' && railMode === 'partner_api';

  return {
    profile,
    network: mainnetLike ? 'mainnet' : 'testnet',
    networkPassphrase: env('ANCHOR_NETWORK_PASSPHRASE') || (mainnetLike ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE),
    horizonUrl: env('ANCHOR_HORIZON_URL') || (mainnetLike ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'),
    sorobanRpcUrl: env('SOROBAN_RPC_URL') || (mainnetLike ? '' : 'https://soroban-testnet.stellar.org'),
    railProvider: providerFromEnv(),
    railMode,
    liveFiatClaimsEnabled,
    feePercent: numberEnv('RAMP_FEE_PERCENT', 2),
    spreadBps: numberEnv('RAMP_SPREAD_BPS', 85),
    quoteTtlMs: numberEnv('RAMP_QUOTE_TTL_MS', 60_000),
    warning: liveFiatClaimsEnabled
      ? undefined
      : mainnetLike
        ? 'Mainnet partner mode requires production credentials; fiat settlement remains operator-confirmed.'
        : 'Testnet demo mode uses simulated fiat settlement.',
  };
}

export function quoteWithLiquidityMetadata(params: {
  id: string;
  amountPhp: string;
  assetAmount: string;
  providerRate: string;
  nowMs?: number;
}): LiquidityQuoteMetadata {
  const profile = getLiquidityProfile();
  const now = params.nowMs ?? Date.now();
  const amountPhp = Number(params.amountPhp);
  const feePhp = Number.isFinite(amountPhp) ? amountPhp * (profile.feePercent / 100) : 0;
  return {
    id: params.id,
    amountPhp: Number.isFinite(amountPhp) ? amountPhp.toFixed(2) : params.amountPhp,
    amountXlm: params.assetAmount,
    rate: params.providerRate,
    feePhp: feePhp.toFixed(2),
    spreadBps: profile.spreadBps,
    railProvider: profile.railProvider,
    railMode: profile.railMode,
    proofReference: params.id.replace(/^rmp_/i, 'RMP-').toUpperCase(),
    expiresAt: now + profile.quoteTtlMs,
  };
}

export function getMainnetReadiness(): ReadinessCheck {
  const profile = getLiquidityProfile();
  if (profile.profile === 'testnet') {
    return {
      name: 'liquidity_network_profile',
      ok: true,
      status: 200,
      detail: 'testnet demo mode',
    };
  }

  const missing: string[] = [];
  const expected = [
    'ANCHOR_NETWORK_PASSPHRASE',
    'ANCHOR_HORIZON_URL',
    'SOROBAN_RPC_URL',
    'VITE_VENDOR_REGISTRY_CONTRACT_ID',
    'VITE_PALENGKE_PAYMENT_CONTRACT_ID',
    'VITE_UTANG_ESCROW_CONTRACT_ID',
    'ANCHOR_SIGNING_SECRET',
    'PDAX_API_KEY',
    'PDAX_API_SECRET',
    'RAMP_ADMIN_KEY',
    'RAMP_WEBHOOK_SECRET',
    'FEE_BUMP_ALLOWED_DESTINATIONS',
  ];
  for (const key of expected) {
    if (!env(key)) missing.push(key);
  }
  if (!env('KV_REST_API_URL') || !env('KV_REST_API_TOKEN')) {
    missing.push('KV_REST_API_URL', 'KV_REST_API_TOKEN');
  }
  if (!boolEnv('FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT')) {
    missing.push('FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT=true');
  }
  if (boolEnv('PDAX_MOCK')) {
    missing.push('PDAX_MOCK=false');
  }

  const passphraseOk = profile.networkPassphrase === MAINNET_PASSPHRASE;
  if (!passphraseOk) missing.push('mainnet network passphrase');

  if (missing.length > 0) {
    return {
      name: 'liquidity_network_profile',
      ok: false,
      status: 503,
      detail: `unsafe ${profile.profile} config; missing: ${missing.join(', ')}`,
    };
  }

  return {
    name: 'liquidity_network_profile',
    ok: profile.liveFiatClaimsEnabled,
    status: profile.liveFiatClaimsEnabled ? 200 : 503,
    detail: profile.liveFiatClaimsEnabled
      ? 'mainnet partner liquidity mode ready'
      : 'Mainnet partner mode requires production credentials',
  };
}

export function resetLiquidityProfileForTests(): void {
  // No module cache is used today. Keep this hook so tests can stay stable if
  // profile reads become cached later.
}
