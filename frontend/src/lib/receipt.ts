import { getServer, simulateViewCall, addressToScVal, stellarExpertUrl } from './stellar';

const REGISTRY_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;

export interface ReceiptVendor {
  name: string;
  stallNumber: string;
  productType: string;
}

export interface Receipt {
  txHash: string;
  from: string;
  to: string;
  amountXlm: string;
  memo: string | null;
  createdAt: string;
  feeChargedXlm: string;
  vendor: ReceiptVendor | null;
  stellarExpertUrl: string;
}

interface HorizonTxRecord {
  hash: string;
  memo_type?: string;
  memo?: string;
  created_at: string;
  fee_charged: string | number;
  source_account: string;
}

interface HorizonPaymentOp {
  type: string;
  type_i: number;
  from?: string;
  to?: string;
  funder?: string;
  account?: string;
  asset_type?: string;
  amount?: string;
  starting_balance?: string;
}

function stroopsToXlm(stroops: string | number): string {
  return (Number(stroops) / 10_000_000).toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}

async function fetchVendor(address: string): Promise<ReceiptVendor | null> {
  if (!REGISTRY_ID) return null;
  try {
    const raw = await simulateViewCall(REGISTRY_ID, 'get_vendor', [addressToScVal(address)]);
    if (!raw) return null;
    const r = raw as Record<string, unknown>;
    return {
      name: String(r.name ?? ''),
      stallNumber: String(r.stall_number ?? ''),
      productType: String(r.product_type ?? ''),
    };
  } catch {
    return null;
  }
}

export async function fetchReceipt(txHash: string): Promise<Receipt> {
  const server = getServer();
  const [tx, opsPage] = await Promise.all([
    server.transactions().transaction(txHash).call() as unknown as Promise<HorizonTxRecord>,
    server.operations().forTransaction(txHash).call() as unknown as Promise<{ records: HorizonPaymentOp[] }>,
  ]);

  const op = opsPage.records.find(
    (o) => (o.type === 'payment' && o.asset_type === 'native') || o.type === 'create_account',
  );
  if (!op) throw new Error('No native payment operation in this transaction.');

  const from = op.from ?? op.funder ?? tx.source_account;
  const to = op.to ?? op.account ?? '';
  const amountXlm = op.amount ?? op.starting_balance ?? '0';
  const memo = tx.memo_type === 'text' && tx.memo ? tx.memo : null;

  const vendor = to ? await fetchVendor(to) : null;

  return {
    txHash: tx.hash,
    from,
    to,
    amountXlm,
    memo,
    createdAt: tx.created_at,
    feeChargedXlm: stroopsToXlm(tx.fee_charged),
    vendor,
    stellarExpertUrl: stellarExpertUrl(tx.hash),
  };
}

export function receiptUrl(txHash: string): string {
  if (typeof window === 'undefined') return `/receipt/${txHash}`;
  return `${window.location.origin}/receipt/${txHash}`;
}

export async function shareReceipt(txHash: string, vendorName?: string, amountXlm?: string): Promise<'shared' | 'copied'> {
  const url = receiptUrl(txHash);
  const title = 'PalengkePay Receipt';
  const text = vendorName && amountXlm
    ? `Payment of ${amountXlm} XLM to ${vendorName} — verified on Stellar.`
    : 'Verified on-chain payment receipt.';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      const aborted = (err as { name?: string }).name === 'AbortError';
      if (aborted) throw err;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }

  throw new Error('Sharing not supported on this device.');
}
