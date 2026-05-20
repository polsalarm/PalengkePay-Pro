import { CheckCircle, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import type { UtangRecord } from '../lib/hooks/useUtang';
import { dueLabel, isOverdue } from '../lib/hooks/useUtang';
import { useVendorName } from '../lib/hooks/useVendor';
import { useFormatAmount } from '../lib/hooks/useDisplayUnit';
import { truncateAddress, stellarExpertUrl } from '../lib/stellar';

interface UtangCardProps {
  utang: UtangRecord;
  perspective: 'vendor' | 'customer';
  onPayInstallment?: (utang: UtangRecord) => void;
  txHash?: string | null;
}

export function UtangCard({ utang, perspective, onPayInstallment, txHash }: UtangCardProps) {
  const progress = utang.installmentsTotal > 0
    ? utang.installmentsPaid / utang.installmentsTotal
    : 0;

  const resolvedVendorName = useVendorName(perspective === 'customer' ? utang.vendorWallet : null);
  const { unit, format } = useFormatAmount();
  const unitLabel = unit === 'php' ? 'PHP' : 'XLM';

  const overdue = utang.status === 'active' && isOverdue(utang.nextDueSecs);

  const counterpartyLabel = perspective === 'vendor' ? 'Customer' : 'Vendor';
  const counterpartyDisplay = perspective === 'customer'
    ? (resolvedVendorName ?? truncateAddress(utang.vendorWallet))
    : truncateAddress(utang.customerWallet);
  const isMono = perspective === 'vendor' || !resolvedVendorName;

  const statusStyle = {
    active: { bg: '#F0FDFA', color: '#008055', border: '#CCFBF1', label: overdue ? 'overdue' : 'active' },
    completed: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'completed' },
    defaulted: { bg: '#FFF1F2', color: '#F43F5E', border: '#FECDD3', label: 'defaulted' },
  }[utang.status];

  const overdueStatusStyle = overdue
    ? { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', label: 'overdue' }
    : statusStyle;

  const finalStatus = overdue ? overdueStatusStyle : statusStyle;

  const barColor = utang.status === 'completed' ? '#22C55E'
    : utang.status === 'defaulted' ? '#F43F5E'
    : overdue ? '#F59E0B'
    : '#008055';

  const cardBorder = utang.status === 'defaulted'
    ? '#FECDD3'
    : overdue
    ? '#FDE68A'
    : '#F1F5F9';

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        border: `1.5px solid ${cardBorder}`,
        boxShadow: overdue ? '0 2px 16px rgba(245,158,11,0.1)' : '0 1px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Overdue banner */}
      {overdue && (
        <div
          className="flex items-center gap-2 px-5 py-2.5"
          style={{ backgroundColor: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}
        >
          <AlertTriangle size={12} style={{ color: '#D97706' }} className="shrink-0" />
          <p className="text-xs font-bold" style={{ color: '#D97706' }}>
            Installment overdue — bayaran na
          </p>
        </div>
      )}

      <div className="bg-white">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>
              {counterpartyLabel}
            </p>
            <p className={`text-sm font-bold text-slate-800 truncate ${isMono ? 'font-mono' : ''}`}>
              {counterpartyDisplay}
            </p>
          </div>
          <span
            className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full capitalize"
            style={{
              backgroundColor: finalStatus.bg,
              color: finalStatus.color,
              border: `1px solid ${finalStatus.border}`,
            }}
          >
            {finalStatus.label}
          </span>
        </div>

        {/* Description */}
        {utang.description && (
          <div className="px-5 pb-3">
            <p
              className="text-xs font-semibold px-3 py-2 rounded-xl"
              style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}
            >
              {utang.description}
            </p>
          </div>
        )}

        {/* Amount + progress */}
        <div className="px-5 pb-3">
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-black text-slate-900" style={{ fontSize: '1.5rem', fontFamily: "'Montserrat', sans-serif" }}>
              {format(utang.totalAmountXlm, { showSuffix: false })}
              <span className="text-sm font-semibold text-slate-400 ml-1.5">{unitLabel}</span>
            </p>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}
            >
              {utang.installmentsPaid}/{utang.installmentsTotal} bayad
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: barColor }}
            />
          </div>

          <p className="text-xs text-slate-400 mt-2">
            {format(utang.installmentAmountXlm, { showSuffix: false })} {unitLabel} × {utang.installmentsTotal} · bawat {utang.intervalDays}d
          </p>

          {/* Due date badge */}
          {utang.status === 'active' && (
            <div
              className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-xl text-xs font-semibold"
              style={overdue
                ? { backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }
                : { backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #F1F5F9' }
              }
            >
              {overdue ? <AlertTriangle size={11} /> : <Clock size={11} />}
              {dueLabel(utang.nextDueSecs)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid #F8FAFC' }}
        >
          <div>
            {utang.status === 'completed' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#16A34A' }}>
                <CheckCircle size={12} />
                Fully paid
              </div>
            )}
            {utang.status === 'defaulted' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#F43F5E' }}>
                <AlertTriangle size={12} />
                Defaulted
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {txHash && (
              <a
                href={stellarExpertUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold active:scale-95"
                style={{ color: '#008055' }}
              >
                View tx <ExternalLink size={11} />
              </a>
            )}
            {perspective === 'customer' && utang.status === 'active' && onPayInstallment && (
              <button
                onClick={() => onPayInstallment(utang)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                style={{
                  backgroundColor: overdue ? '#D97706' : '#008055',
                  boxShadow: overdue
                    ? '0 2px 8px rgba(217,119,6,0.3)'
                    : '0 2px 8px rgba(15,118,110,0.3)',
                }}
              >
                Bayaran
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
