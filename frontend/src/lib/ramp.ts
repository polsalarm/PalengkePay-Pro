/**
 * Client-side wrapper for the /api/ramp endpoints.
 *
 * Status semantics mirror SEP-24 status values plus our internal extras:
 *   - incomplete                 quote drafted, awaiting confirmation
 *   - pending_user_transfer_start customer needs to send XLM (off-ramp)
 *   - pending_anchor              anchor processing (PDAX swap in flight)
 *   - pending_external            PDAX cashout / external rail in flight
 *   - pending_stellar             XLM withdrawal in flight (on-ramp)
 *   - completed                   terminal success
 *   - error                       terminal failure
 */

export type Rail = 'INSTAPAY' | 'PESONET' | 'EWALLET' | 'BANK';

export interface RampTxn {
  id: string;
  wallet: string;
  kind: 'deposit' | 'withdraw';
  status: string;
  network?: 'testnet' | 'mainnet';
  asset: string;
  amountIn: string;
  amountOut?: string;
  amountFee?: string;
  rate?: string;
  rail?: string;
  railProvider?: string;
  railMode?: 'mock' | 'manual_operator' | 'partner_api';
  feePhp?: string;
  spreadBps?: number;
  proofReference?: string;
  destination?: string;
  stellarTxHash?: string;
  externalTxId?: string;
  providerStatus?: string;
  operatorNote?: string;
  settlementEvents?: Array<{
    at: number;
    status: string;
    label: string;
    message?: string;
    operatorNote?: string;
    externalTxId?: string;
    providerStatus?: string;
  }>;
  message?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface CashoutCreateResult {
  id: string;
  depositAddress: string;
  memo: string;
  memoType: 'TEXT' | 'ID' | 'HASH';
  amountXlm: string;
  rail: Rail;
  destination: string;
  beneficiaryName: string;
  status: string;
  network?: 'testnet' | 'mainnet';
  railProvider?: string;
  railMode?: 'mock' | 'manual_operator' | 'partner_api';
  spreadBps?: number;
}

export interface CashinQuoteResult {
  id: string;
  amountPhp: string;
  amountXlm: string;
  rate: string;
  feePhp?: string;
  spreadBps?: number;
  railProvider?: string;
  railMode?: 'mock' | 'manual_operator' | 'partner_api';
  proofReference?: string;
  expiresAt: number;
  instructions: { rail: string; reference: string };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? `${path} failed`);
  return data as unknown as T;
}

async function adminRequest<T>(adminKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
      ...(init.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? `admin ${res.status}`);
  return data as T;
}

export function createCashout(params: { wallet: string; amountXlm: string; rail: Rail; destination: string; beneficiaryName: string }): Promise<CashoutCreateResult> {
  return post<CashoutCreateResult>('/api/ramp/cashout?action=create', params);
}

export function settleCashout(params: { id: string; stellarTxHash: string }): Promise<{ id: string; status: string; amountOut?: string; reference?: string }> {
  return post('/api/ramp/cashout?action=settle', params);
}

export function quoteCashin(params: { wallet: string; amountPhp: string }): Promise<CashinQuoteResult> {
  return post<CashinQuoteResult>('/api/ramp/cashin?action=quote', params);
}

export function previewCashinQuote(params: { amountPhp: string }): Promise<CashinQuoteResult> {
  return post<CashinQuoteResult>('/api/ramp/cashin?action=preview', params);
}

export function confirmCashin(params: { id: string; reference?: string; proofReference?: string; operatorNote?: string }): Promise<{ id: string; status: string; amountXlm?: string }> {
  return post('/api/ramp/cashin?action=confirm', params);
}

export async function getStatus(id: string): Promise<RampTxn | null> {
  const res = await fetch(`/api/ramp/status?id=${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { transaction: RampTxn };
  return data.transaction;
}

export async function listRamps(wallet: string): Promise<RampTxn[]> {
  const res = await fetch(`/api/ramp/status?wallet=${encodeURIComponent(wallet)}`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { transactions: RampTxn[] };
  return data.transactions;
}

export async function listAllRamps(adminKey: string): Promise<RampTxn[]> {
  const data = await adminRequest<{ transactions?: RampTxn[] }>(adminKey, '/api/ramp/admin?scope=all', { method: 'GET' });
  return data.transactions ?? [];
}

export async function exportRamps(adminKey: string, format: 'csv' | 'json'): Promise<Blob> {
  const res = await fetch(`/api/ramp/admin?scope=all&export=${format}`, {
    headers: { 'x-admin-key': adminKey },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `export ${res.status}`);
  }
  return await res.blob();
}

export async function seedDemoRamps(adminKey: string): Promise<RampTxn[]> {
  const data = await adminRequest<{ transactions?: RampTxn[] }>(adminKey, '/api/ramp/admin?action=seed_demo', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return data.transactions ?? [];
}

export function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'error' || status === 'no_market';
}

export const RAIL_LABELS: Record<Rail, string> = {
  INSTAPAY: 'InstaPay (bank)',
  PESONET: 'PesoNet (bank)',
  EWALLET: 'GCash / Maya',
  BANK: 'Direct bank credit',
};
