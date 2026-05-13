import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { QRGenerator } from '../../components/QRGenerator';

export function VendorQR() {
  const { address, isConnected } = useWallet();
  const { vendor, isLoading } = useVendor(address);
  const navigate = useNavigate();

  if (!isConnected) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: '#00284B' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Connect wallet to see your QR code.
        </p>
      </div>
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
            {vendor?.name ?? 'My QR Code'}
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
        ) : (
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
        )}
      </div>

      {/* Bottom hint */}
      <div
        className="relative px-6 py-5 text-center shrink-0"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
          I-scan ng customer para magbayad · works offline
        </p>
      </div>
    </div>
  );
}
