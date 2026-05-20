export type PaymentSettlementMode = 'contract' | 'fee-bump';

const STROOPS_PER_XLM = 10_000_000n;
const MAX_DECIMAL_PLACES = 7;

export function getPaymentContractId(): string | undefined {
  return import.meta.env.VITE_PALENGKE_PAYMENT_CONTRACT_ID as string | undefined;
}

export function resolvePaymentSettlementMode(contractId?: string): PaymentSettlementMode {
  const configuredContractId = arguments.length === 0 ? getPaymentContractId() : contractId;
  return configuredContractId?.trim() ? 'contract' : 'fee-bump';
}

export function xlmToStroops(amountXlm: string): bigint {
  const trimmed = amountXlm.trim();
  if (trimmed.startsWith('-')) {
    throw new Error('amount must be greater than 0');
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('amount must be a valid XLM value');
  }

  const [wholePart, rawFractionPart = ''] = trimmed.split('.');
  if (rawFractionPart.length > MAX_DECIMAL_PLACES) {
    throw new Error('amount supports at most 7 decimal places');
  }

  const fractionPart = rawFractionPart.padEnd(MAX_DECIMAL_PLACES, '0').slice(0, MAX_DECIMAL_PLACES);
  const stroops = BigInt(wholePart) * STROOPS_PER_XLM + BigInt(fractionPart);

  if (stroops <= 0n) {
    throw new Error('amount must be greater than 0');
  }

  return stroops;
}
