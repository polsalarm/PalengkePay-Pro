import { AlertTriangle, ArrowLeft, ArrowRight, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { QRGenerator } from '../../components/QRGenerator';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { REGISTRY_CONTRACT_ID } from '../../lib/contracts';

export function VendorQR() {
  const { address } = useWallet();
  const { vendor, isLoading } = useVendor(address);
  const navigate = useNavigate();

  if (!address) {
    return (
      <WalletRequiredState
        detail="Connect your vendor wallet to display the QR code customers use for payment."
        fullScreen
        tone="dark"
      />
    );
  }

  const stallInfo = vendor
    ? `Stall ${vendor.stallNumber} · ${vendor.productType}`
    : undefined;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#00284B' }}
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

      {/* Top bar */}
      <div className="relative flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button
          onClick={() => navigate('/vendor/home')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
        </button>
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Your QR Code
          </p>
          <h1
            className="text-base font-black text-white leading-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {vendor?.name ?? (isLoading ? 'My QR Code' : 'Register first')}
          </h1>
        </div>
      </div>

      {/* QR — centered, fills remaining space */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-6">
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
          <div
            className="w-full rounded-3xl p-6"
            style={{
              backgroundColor: 'white',
              maxWidth: '320px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}
          >
            <QRGenerator
              value={address!}
              size={260}
              vendorName={vendor?.name ?? 'Your QR Code'}
              stallInfo={stallInfo}
              downloadable
            />
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
              {REGISTRY_CONTRACT_ID ? 'Register your stall first' : 'Vendor registry unavailable'}
            </p>
            <p className="text-sm text-slate-500 mb-5">
              {REGISTRY_CONTRACT_ID
                ? 'Your customer QR appears after your vendor profile is registered.'
                : 'Set the vendor registry contract ID before QR profiles can load.'}
            </p>
            {REGISTRY_CONTRACT_ID && (
              <button
                onClick={() => navigate('/vendor/apply')}
                className="w-full flex items-center justify-center gap-2 text-sm font-black rounded-2xl active:scale-95 text-white"
                style={{ backgroundColor: '#008055', minHeight: '52px' }}
              >
                Apply as Vendor <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {vendor && (
        <div
          className="relative px-6 py-5 text-center shrink-0"
          style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
        >
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            I-scan ng customer para magbayad · works offline
          </p>
        </div>
      )}
    </div>
  );
}
