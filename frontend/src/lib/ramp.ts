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
  asset: string;
  amountIn: string;
  amountOut?: string;
  amountFee?: string;
  rate?: string;
  rail?: string;
  destination?: string;
  stellarTxHash?: string;
  externalTxId?: string;
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
}

export interface CashinQuoteResult {
  id: string;
  amountPhp: string;
  amountXlm: string;
  rate: string;
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

export function createCashout(params: { wallet: string; amountXlm: string; rail: Rail; destination: string; beneficiaryName: string }): Promise<CashoutCreateResult> {
  return post<CashoutCreateResult>('/api/ramp/cashout?action=create', params);
}

export function settleCashout(params: { id: string; stellarTxHash: string }): Promise<{ id: string; status: string; amountOut?: string; reference?: string }> {
  return post('/api/ramp/cashout?action=settle', params);
}

export function quoteCashin(params: { wallet: string; amountPhp: string }): Promise<CashinQuoteResult> {
  return post<CashinQuoteResult>('/api/ramp/cashin?action=quote', params);
}

export function confirmCashin(params: { id: string; reference?: string }): Promise<{ id: string; status: string; amountXlm?: string }> {
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

export function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'error' || status === 'no_market';
}

export const RAIL_LABELS: Record<Rail, string> = {
  INSTAPAY: 'InstaPay (bank)',
  PESONET: 'PesoNet (bank)',
  EWALLET: 'GCash / Maya',
  BANK: 'Direct bank credit',
};
