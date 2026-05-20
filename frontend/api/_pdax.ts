/**
 * PDAX REST client.
 *
 * Auth: HMAC SHA-384 over `nonce + url + body`. Headers:
 *   Access-Key, Access-Signature, Access-Nonce (ms).
 * Docs: https://doc.restapi.pdax.ph/
 *
 * Mock mode: set PDAX_MOCK=true (or omit PDAX_API_KEY) to return plausible
 * fixtures instead of hitting the live endpoint. Lets the rest of the stack
 * (SEP-24 anchor, ramp flows, UI) develop end-to-end without sandbox creds.
 */
import { createHmac } from 'node:crypto';
import { anchorPublicKey, sendPayment, isAnchorConfigured } from './_anchor.js';

const API_KEY = process.env.PDAX_API_KEY;
const API_SECRET = process.env.PDAX_API_SECRET;
const BASE_URL = process.env.PDAX_BASE_URL ?? 'https://api.pdax.ph';
const MOCK = process.env.PDAX_MOCK === 'true' || !API_KEY || !API_SECRET;
const RATE_FALLBACK = Number(process.env.RAMP_RATE_FALLBACK ?? '7.85');

export type Side = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';

export interface Market {
  symbol: string;
  base: string;
  quote: string;
  minOrderSize: string;
  priceTick: string;
  active: boolean;
}

export interface Order {
  id: string;
  market: string;
  side: Side;
  type: OrderType;
  status: 'NEW' | 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';
  filledAmount: string;
  averagePrice: string;
  createdAt: number;
}

export interface DepositAddress {
  asset: string;
  address: string;
  memo: string;
  memoType: 'TEXT' | 'ID' | 'HASH';
}

export interface CashoutReceipt {
  id: string;
  amountPhp: string;
  rail: 'INSTAPAY' | 'PESONET' | 'EWALLET' | 'BANK';
  destination: string;
  status: 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED';
  reference: string;
}

export interface WithdrawCryptoParams {
  asset: string;
  amount: string;
  address: string;
  memo?: string;
  memoType?: 'TEXT' | 'ID' | 'HASH';
  otp?: string;
}

function sign(nonce: string, path: string, body: string): string {
  if (!API_SECRET) throw new Error('PDAX_API_SECRET not set');
  return createHmac('sha384', API_SECRET).update(nonce + path + body).digest('hex');
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, payload?: unknown): Promise<T> {
  if (MOCK) return await mock<T>(method, path, payload);
  if (!API_KEY) throw new Error('PDAX_API_KEY not set');

  const nonce = String(Date.now());
  const body = method === 'GET' || !payload ? '' : JSON.stringify(payload);
  const url = `${BASE_URL}${path}`;
  const signature = sign(nonce, path, body);

  const headers: Record<string, string> = {
    'Access-Key': API_KEY,
    'Access-Signature': signature,
    'Access-Nonce': nonce,
  };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { method, headers, body: body || undefined });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`pdax ${method} ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

async function mock<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const now = Date.now();
  if (path === '/markets') {
    return [
      { symbol: 'XLM-PHPT', base: 'XLM', quote: 'PHPT', minOrderSize: '5', priceTick: '0.0001', active: true },
    ] as unknown as T;
  }
  if (method === 'POST' && path === '/orders') {
    const p = payload as { market: string; side: Side; type: OrderType; amount: string };
    return {
      id: `mock-order-${now}`,
      market: p.market,
      side: p.side,
      type: p.type,
      status: 'FILLED',
      filledAmount: p.amount,
      averagePrice: String(RATE_FALLBACK),
      createdAt: now,
    } as unknown as T;
  }
  if (method === 'GET' && path.startsWith('/orders/')) {
    return { id: path.split('/').pop(), market: 'XLM-PHPT', side: 'SELL', type: 'MARKET', status: 'FILLED', filledAmount: '0', averagePrice: String(RATE_FALLBACK), createdAt: now } as unknown as T;
  }
  if (method === 'POST' && path === '/deposit-address') {
    const p = payload as { asset: string; userId: string };
    // Hackathon mode: anchor's own Stellar account = deposit address.
    // Real PDAX would return their custody address; here the operator IS the custodian.
    const address = isAnchorConfigured()
      ? anchorPublicKey()
      : 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';
    return {
      asset: p.asset,
      address,
      memo: p.userId.slice(0, 28),
      memoType: 'TEXT',
    } as unknown as T;
  }
  if (method === 'POST' && path === '/withdraw-crypto') {
    const p = payload as WithdrawCryptoParams;
    // Hackathon mode: if anchor is configured, actually send the XLM from
    // the anchor account to the customer. Otherwise return a placeholder.
    if (p.asset === 'XLM' && isAnchorConfigured()) {
      try {
        const result = await sendPayment(p.address, p.amount, p.memo);
        return { id: result.hash, status: 'COMPLETED', stellarTxHash: result.hash } as unknown as T;
      } catch (err: unknown) {
        return { id: `mock-wd-${now}`, status: 'FAILED', error: (err as Error).message } as unknown as T;
      }
    }
    return { id: `mock-wd-${now}`, status: 'PENDING' } as unknown as T;
  }
  if (method === 'POST' && path === '/cashout') {
    const p = payload as { amountPhp: string; rail: string; destination: string };
    // Hackathon mode: PHP payout requires manual operator settlement via the
    // admin UI. Return PENDING so the ramp txn stays in pending_external until
    // admin marks mark_php_sent.
    return {
      id: `mock-co-${now}`,
      amountPhp: p.amountPhp,
      rail: p.rail,
      destination: p.destination,
      status: 'PENDING',
      reference: `PP${now}`,
    } as unknown as T;
  }
  if (method === 'POST' && path === '/cashin/quote') {
    const p = payload as { amountPhp: string; asset: string };
    return {
      quoteId: `mock-q-${now}`,
      amountPhp: p.amountPhp,
      asset: p.asset,
      assetAmount: String(Number(p.amountPhp) / RATE_FALLBACK),
      rate: String(RATE_FALLBACK),
      expiresAt: now + 60_000,
    } as unknown as T;
  }
  throw new Error(`pdax mock: unhandled ${method} ${path}`);
}

export function isMock(): boolean {
  return MOCK;
}

export function getMarkets(): Promise<Market[]> {
  return call<Market[]>('GET', '/markets');
}

export function placeOrder(params: { market: string; side: Side; type: OrderType; amount: string; limitPrice?: string }): Promise<Order> {
  return call<Order>('POST', '/orders', params);
}

export function getOrder(id: string): Promise<Order> {
  return call<Order>('GET', `/orders/${id}`);
}

export function getDepositAddress(asset: string, userId: string): Promise<DepositAddress> {
  return call<DepositAddress>('POST', '/deposit-address', { asset, userId });
}

export function withdrawCrypto(params: WithdrawCryptoParams): Promise<{ id: string; status: string }> {
  if (!params.address) throw new Error('withdrawCrypto: address required');
  if (params.asset === 'XLM' && !params.memo) {
    throw new Error('withdrawCrypto: memo required for XLM');
  }
  return call('POST', '/withdraw-crypto', params);
}

export function requestCashout(params: { amountPhp: string; rail: 'INSTAPAY' | 'PESONET' | 'EWALLET' | 'BANK'; destination: string; beneficiaryName: string }): Promise<CashoutReceipt> {
  return call<CashoutReceipt>('POST', '/cashout', params);
}

export function quoteCashin(params: { amountPhp: string; asset: string }): Promise<{ quoteId: string; amountPhp: string; asset: string; assetAmount: string; rate: string; expiresAt: number }> {
  return call('POST', '/cashin/quote', params);
}
