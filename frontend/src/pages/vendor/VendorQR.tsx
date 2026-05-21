import { AlertTriangle, ArrowRight, Printer, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { QRGenerator } from '../../components/QRGenerator';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { REGISTRY_CONTRACT_ID } from '../../lib/contracts';
import { useLanguage } from '../../contexts/LanguageContext';

export function VendorQR() {
  const { address } = useWallet();
  const { vendor, isLoading } = useVendor(address);
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!address) {
    return (
      <WalletRequiredState
        detail={t('qr.connectWalletDetail')}
        fullScreen
        tone="dark"
      />
    );
  }

  const stallInfo = vendor
    ? `${t('qr.stall')} ${vendor.stallNumber} · ${vendor.productType}`
    : undefined;

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ 
        backgroundColor: '#00284B',
        marginTop: '-24px',
        marginBottom: '-24px',
      }}
    >
      {/* Banig texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg, white 0px, white 1px, transparent 1px, transparent 12px
          ), repeating-linear-gradient(
            -45deg, white 0px, white 1px, transparent 1px, transparent 12px
          )`,
        }}
      />
      
      {/* Ambient glow */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Page Title */}
      <div className="relative px-4 pt-8 pb-4 shrink-0">
        <p
          className="text-xs font-bold uppercase tracking-widest text-center"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {t('qr.yourQRCode')}
        </p>
        <h1
          className="text-xl font-black text-white text-center leading-tight mt-1"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {vendor?.name ?? (isLoading ? t('qr.myQRCode') : t('qr.registerFirst'))}
        </h1>
        {stallInfo && !isLoading && vendor && (
          <p className="text-sm text-center mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {stallInfo}
          </p>
        )}
      </div>

      {/* QR Code */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-64 h-64 rounded-3xl animate-pulse"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            />
            <div className="h-5 w-40 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <div className="h-4 w-28 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
          </div>
        ) : vendor ? (
          <div className="w-full max-w-5xl space-y-4">
            <div
              className="w-full rounded-3xl p-4 sm:p-6 mx-auto screen-only"
              style={{
                backgroundColor: 'white',
                maxWidth: '320px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              }}
            >
              <QRGenerator
                value={address!}
                size={240}
                vendorName={vendor?.name ?? t('qr.myQRCode')}
                stallInfo={stallInfo}
                downloadable
              />
            </div>
            <QrPrintKit vendorName={vendor.name} stallInfo={stallInfo} wallet={address} />
          </div>
        ) : (
          <div
            className="w-full rounded-3xl p-6 text-center"
            style={{
              backgroundColor: 'white',
              maxWidth: '320px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                backgroundColor: REGISTRY_CONTRACT_ID ? '#F0FDFA' : '#FFFBEB',
                border: `1.5px solid ${REGISTRY_CONTRACT_ID ? '#CCFBF1' : '#FDE68A'}`,
              }}
            >
              {REGISTRY_CONTRACT_ID
                ? <Store size={28} style={{ color: '#008055' }} />
                : <AlertTriangle size={28} style={{ color: '#D97706' }} />
              }
            </div>
            <p className="text-base font-black text-slate-900 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {REGISTRY_CONTRACT_ID ? t('qr.registerStallFirst') : t('qr.registryUnavailable')}
            </p>
            <p className="text-sm text-slate-500 mb-5">
              {REGISTRY_CONTRACT_ID
                ? t('qr.registerHint')
                : t('qr.registryHint')}
            </p>
            {REGISTRY_CONTRACT_ID && (
              <button
                onClick={() => navigate('/vendor/apply')}
                className="w-full flex items-center justify-center gap-2 text-sm font-black rounded-2xl active:scale-95 text-white"
                style={{ backgroundColor: '#008055', minHeight: '52px' }}
              >
                {t('qr.applyAsVendor')} <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom hint - only show if vendor exists */}
      {vendor && (
        <div
          className="relative px-6 py-6 text-center shrink-0"
          style={{ 
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {t('qr.bottomHint')}
          </p>
        </div>
      )}
    </div>
  );
}

function QrPrintKit({ vendorName, stallInfo, wallet }: { vendorName: string; stallInfo?: string; wallet: string }) {
  const { t } = useLanguage();
  
  return (
    <section className="qr-print-kit rounded-3xl bg-white p-5 space-y-4" style={{ border: '1.5px solid #E2E8F0' }}>
      <style>
        {`@media print {
          body * { visibility: hidden; }
          .qr-print-kit, .qr-print-kit * { visibility: visible; }
          .qr-print-kit { position: absolute; inset: 0; display: block !important; border: 0 !important; border-radius: 0 !important; padding: 0.35in !important; }
          .screen-only { display: none !important; }
          .print-grid { display: grid !important; grid-template-columns: 1.45fr 0.85fr; gap: 0.25in; align-items: start; }
        }`}
      </style>
      <div className="screen-only flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('qr.printReady')}</p>
          <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {t('qr.posterPreview')}
          </h2>
        </div>
        <button
          onClick={() => window.print()}
          className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95"
          style={{ backgroundColor: '#008055', color: 'white' }}
          aria-label={t('qr.printKit')}
        >
          <Printer size={18} />
        </button>
      </div>

      <div className="print-grid grid gap-3 sm:gap-4 lg:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-3xl p-4 sm:p-6 text-center min-w-0" style={{ border: '2px solid #0F172A', backgroundColor: '#FFFDF7' }}>
          <p className="text-xs sm:text-sm font-black uppercase tracking-[0.18em]" style={{ color: '#008055' }}>PalengkePay</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-950 mt-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {t('qr.scanToPay')}
          </h3>
          <p className="text-base sm:text-lg font-bold text-slate-700 mt-1 break-words">{vendorName}</p>
          {stallInfo && <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 break-words">{stallInfo}</p>}
          <div className="flex justify-center my-4 sm:my-5">
            <QRGenerator value={wallet} size={300} vendorName={vendorName} stallInfo={stallInfo} showCaption={false} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
            {[t('qr.step1'), t('qr.step2'), t('qr.step3')].map((step, index) => (
              <div key={step} className="rounded-2xl p-3 flex sm:block items-center gap-2" style={{ backgroundColor: '#F0FDFA', border: '1px solid #A7F3D0' }}>
                <p className="text-xs font-black shrink-0" style={{ color: '#008055' }}>0{index + 1}</p>
                <p className="text-xs font-bold text-slate-800 sm:mt-1">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl p-4 sm:p-5 text-center min-w-0" style={{ border: '2px dashed #0F172A', backgroundColor: '#F8FAFC' }}>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">{t('qr.sticker')}</p>
          <h3 className="text-lg sm:text-xl font-black text-slate-950 mt-1 break-words" style={{ fontFamily: "'Montserrat', sans-serif" }}>{vendorName}</h3>
          <p className="text-xs text-slate-500 mt-1 break-words">{stallInfo ?? t('qr.vendorQR')}</p>
          <div className="flex justify-center my-4">
            <QRGenerator value={wallet} size={180} vendorName={vendorName} stallInfo={stallInfo} showCaption={false} />
          </div>
          <p className="text-xs font-bold text-slate-600">{t('qr.stickerHint')}</p>
        </div>
      </div>
    </section>
  );
}