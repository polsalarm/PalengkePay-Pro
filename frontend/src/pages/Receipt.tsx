import { ExternalLink, Printer, ReceiptText, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatPhp, formatXlm } from '../lib/checkout-quote';
import { getPaymentProofByHash } from '../lib/payment-proof';
import { stellarExpertUrl, truncateAddress } from '../lib/stellar';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-black text-slate-900 mt-1 break-words">{value}</p>
    </div>
  );
}

export function Receipt() {
  const { txHash = '' } = useParams();
  const proof = getPaymentProofByHash(txHash);
  const explorerUrl = txHash ? stellarExpertUrl(txHash) : null;

  return (
    <div className="min-h-screen px-4 py-5" style={{ backgroundColor: '#F8FAFC' }}>
      <section className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-3xl overflow-hidden bg-white" style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 18px 48px rgba(15,23,42,0.08)' }}>
          <div className="p-5 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
                  <ReceiptText size={24} style={{ color: '#008055' }} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Digital Resibo</p>
                  <h1 className="text-2xl font-black text-slate-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    Payment receipt
                  </h1>
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 print:hidden"
                style={{ backgroundColor: '#F1F5F9', color: '#0F172A' }}
                aria-label="Print receipt"
              >
                <Printer size={18} />
              </button>
            </div>

            {proof ? (
              <>
                <div className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: '#F0FDFA', border: '1.5px solid #A7F3D0' }}>
                  <ShieldCheck size={20} style={{ color: '#008055' }} />
                  <div>
                    <p className="text-sm font-black text-slate-900">Wallet-signed Testnet proof saved on this device</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Verify final settlement on Stellar Expert before using this receipt outside the demo.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Customer paid" value={formatPhp(proof.quote.phpAmount)} />
                  <DetailRow label="Settled amount" value={formatXlm(proof.amountXlm)} />
                  <DetailRow label="Customer wallet" value={truncateAddress(proof.from)} />
                  <DetailRow label="Vendor wallet" value={truncateAddress(proof.to)} />
                  <DetailRow label="Quote source" value={proof.quote.source} />
                  <DetailRow label="Settlement mode" value={proof.settlementMode} />
                  <DetailRow label="Memo" value={proof.memo || 'No memo'} />
                  <DetailRow label="Captured at" value={new Date(proof.createdAt).toLocaleString()} />
                </div>
              </>
            ) : (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
                <p className="text-sm font-black text-slate-900">Receipt proof not found on this device</p>
                <p className="text-xs text-orange-800 mt-1">
                  This route can still verify the transaction hash externally, but the dual-currency quote is only available after the wallet-signed payment is saved locally.
                </p>
              </div>
            )}

            {txHash && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#0F172A' }}>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Transaction hash</p>
                <p className="text-sm font-mono text-white break-words mt-2">{txHash}</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 print:hidden">
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-black text-white active:scale-95"
                  style={{ backgroundColor: '#008055' }}
                >
                  <ExternalLink size={16} /> Verify on Stellar Expert
                </a>
              )}
              <Link
                to="/customer/scan"
                className="min-h-12 rounded-2xl flex items-center justify-center text-sm font-black active:scale-95"
                style={{ backgroundColor: '#E2E8F0', color: '#0F172A' }}
              >
                Start another payment
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
