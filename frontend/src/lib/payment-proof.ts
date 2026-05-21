import type { StableCheckoutQuote } from './checkout-quote';
import type { PaymentHistoryRecord } from './payment-source';
import type { PaymentSettlementMode } from './payment-routing';

const PREFIX = 'pp_payment_proofs_';
const MAX_PROOFS_PER_WALLET = 100;

export interface PaymentProofRecord {
  txHash: string;
  from: string;
  to: string;
  amountXlm: number;
  createdAt: string;
  memo?: string;
  settlementMode: PaymentSettlementMode;
  quote: StableCheckoutQuote;
}

function storageKey(wallet: string): string {
  return `${PREFIX}${wallet}`;
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getPaymentProofs(wallet: string, storage?: Storage): PaymentProofRecord[] {
  const target = getStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(storageKey(wallet));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentProofRecord[];
    return Array.isArray(parsed) ? parsed.filter(isPaymentProofRecord) : [];
  } catch {
    return [];
  }
}

export function getAllPaymentProofs(storage?: Storage): PaymentProofRecord[] {
  const target = getStorage(storage);
  if (!target) return [];

  const byHash = new Map<string, PaymentProofRecord>();
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (!key?.startsWith(PREFIX)) continue;
    const wallet = key.slice(PREFIX.length);
    for (const proof of getPaymentProofs(wallet, target)) {
      byHash.set(proof.txHash, proof);
    }
  }
  return Array.from(byHash.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getPaymentProofByHash(txHash: string, storage?: Storage): PaymentProofRecord | null {
  const normalized = txHash.trim();
  if (!normalized) return null;
  return getAllPaymentProofs(storage).find((proof) => proof.txHash === normalized) ?? null;
}

export function savePaymentProof(proof: PaymentProofRecord, storage?: Storage): void {
  const target = getStorage(storage);
  if (!target || !isPaymentProofRecord(proof)) return;

  for (const wallet of new Set([proof.from, proof.to])) {
    const proofs = [proof, ...getPaymentProofs(wallet, target).filter((existing) => existing.txHash !== proof.txHash)]
      .slice(0, MAX_PROOFS_PER_WALLET);
    try {
      target.setItem(storageKey(wallet), JSON.stringify(proofs));
    } catch {
      // Ignore storage quota/private-mode failures; proof still exists in receipt state.
    }
  }
}

export function enrichPaymentHistoryWithProofs(
  payments: PaymentHistoryRecord[],
  wallet: string,
  storage?: Storage,
): PaymentHistoryRecord[] {
  const proofs = getPaymentProofs(wallet, storage);
  if (proofs.length === 0) return payments;

  return payments.map((payment) => {
    const proof = findMatchingProof(payment, proofs);
    if (!proof) return payment;
    return {
      ...payment,
      txHash: payment.txHash ?? proof.txHash,
      quote: payment.quote ?? proof.quote,
    };
  });
}

function findMatchingProof(payment: PaymentHistoryRecord, proofs: PaymentProofRecord[]): PaymentProofRecord | null {
  return proofs.find((proof) => payment.txHash && proof.txHash === payment.txHash)
    ?? proofs.find((proof) => proofFingerprint(proof) === paymentFingerprint(payment))
    ?? null;
}

function paymentFingerprint(payment: PaymentHistoryRecord): string {
  return [
    payment.from,
    payment.to,
    payment.amountXlm.toFixed(7),
    payment.memo?.trim() ?? '',
  ].join('|');
}

function proofFingerprint(proof: PaymentProofRecord): string {
  return [
    proof.from,
    proof.to,
    proof.amountXlm.toFixed(7),
    proof.memo?.trim() ?? '',
  ].join('|');
}

function isPaymentProofRecord(value: unknown): value is PaymentProofRecord {
  const proof = value as Partial<PaymentProofRecord>;
  return typeof proof?.txHash === 'string'
    && typeof proof.from === 'string'
    && typeof proof.to === 'string'
    && typeof proof.amountXlm === 'number'
    && Number.isFinite(proof.amountXlm)
    && typeof proof.createdAt === 'string'
    && !!proof.quote
    && typeof proof.quote.phpAmount === 'number'
    && typeof proof.quote.phpPerXlm === 'number'
    && typeof proof.quote.xlmAmount === 'string'
    && typeof proof.quote.generatedAt === 'string'
    && typeof proof.quote.expiresAt === 'string';
}
