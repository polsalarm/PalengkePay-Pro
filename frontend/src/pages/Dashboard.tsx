import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';
import { isRegisteredVendor } from '../lib/hooks/useVendor';

export function Dashboard() {
  const { address, isConnected } = useWallet();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      navigate('/connect');
      return;
    }
    if (!address) return;

    isRegisteredVendor(address)
      .then((isVendor) => {
        navigate(isVendor ? '/vendor/home' : '/customer/home', { replace: true });
      })
      .catch(() => navigate('/customer/home', { replace: true }))
      .finally(() => setChecking(false));
  }, [address, isConnected, navigate]);

  if (!checking) return null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#0A3D38' }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 65%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <span
          className="font-black text-white text-2xl"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >₱</span>
      </div>
      <div className="flex items-center gap-2.5 relative">
        <Loader2 size={16} className="animate-spin" style={{ color: '#14B8A6' }} />
        <span
          className="text-sm font-semibold"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          Loading…
        </span>
      </div>
    </div>
  );
}
