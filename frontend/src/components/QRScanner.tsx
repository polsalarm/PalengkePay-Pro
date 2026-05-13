import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Keyboard, ImageUp } from 'lucide-react';

export interface QRScanMeta {
  name?: string;
  stallInfo?: string;
}

interface Props {
  onScan: (address: string, meta?: QRScanMeta) => void;
  onManualEntry?: () => void;
  /** Return true to mark as handled — skips payment address parsing */
  onRawScan?: (text: string) => boolean;
}

const FILE_SCAN_DIV = 'qr-file-scanner-hidden';

export function QRScanner({ onScan, onManualEntry, onRawScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerId = 'qr-scanner-container';
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        const raw = decodedText.trim();

        if (onRawScan?.(raw)) return;

        let address = raw;
        let meta: QRScanMeta | undefined;

        try {
          const parsed = JSON.parse(raw) as { a?: string; n?: string; s?: string };
          if (typeof parsed.a === 'string' && parsed.a.startsWith('G') && parsed.a.length === 56) {
            address = parsed.a;
            if (parsed.n) meta = { name: parsed.n, stallInfo: parsed.s ?? undefined };
          }
        } catch (parseError) {
          void parseError;
          // Not JSON — treat as plain Stellar address
        }

        if (address.startsWith('G') && address.length === 56) {
          onScan(address, meta);
        } else {
          setError('QR code is not a Stellar address. Try again.');
          setTimeout(() => setError(null), 3000);
        }
      },
      (scanError) => {
        void scanError;
      }
    )
      .then(() => setStarted(true))
      .catch((err) => {
        setError(`Camera error: ${(err as Error).message ?? 'permission denied'}`);
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {
          // Scanner may already be stopped during unmount.
        });
      }
    };
  }, [onRawScan, onScan]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    setError(null);

    let div = document.getElementById(FILE_SCAN_DIV);
    if (!div) {
      div = document.createElement('div');
      div.id = FILE_SCAN_DIV;
      div.style.display = 'none';
      document.body.appendChild(div);
    }

    const tempScanner = new Html5Qrcode(FILE_SCAN_DIV);
    try {
      const raw = (await tempScanner.scanFile(file, false)).trim();

      if (onRawScan?.(raw)) return;

      let address = raw;
      let meta: QRScanMeta | undefined;
      try {
        const parsed = JSON.parse(raw) as { a?: string; n?: string; s?: string };
        if (typeof parsed.a === 'string' && parsed.a.startsWith('G') && parsed.a.length === 56) {
          address = parsed.a;
          if (parsed.n) meta = { name: parsed.n, stallInfo: parsed.s ?? undefined };
        }
      } catch (parseError) {
        void parseError;
        // Not JSON — treat as plain Stellar address
      }

      if (address.startsWith('G') && address.length === 56) {
        onScan(address, meta);
      } else {
        setError('QR code is not a Stellar address.');
        setTimeout(() => setError(null), 4000);
      }
    } catch {
      setError('Could not read QR from image. Try a clearer photo.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setUploading(false);
      try { await tempScanner.clear(); } catch (clearError) {
        void clearError;
        // File scanner cleanup is best-effort.
      }
    }
  };

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <div id={containerId} className="w-full" style={{ minHeight: 300 }} />

        {/* Corner bracket viewfinder overlay */}
        {started && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[220px] h-[220px]">
              {/* Top-left */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-teal-400 rounded-tl-md" />
              {/* Top-right */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-teal-400 rounded-tr-md" />
              {/* Bottom-left */}
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-teal-400 rounded-bl-md" />
              {/* Bottom-right */}
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-teal-400 rounded-br-md" />
              {/* Scan line */}
              <div className="absolute left-2 right-2 h-0.5 bg-teal-400 animate-scan" style={{ boxShadow: '0 0 6px rgba(20,184,166,0.8)' }} />
            </div>
          </div>
        )}

        {!started && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-3 text-white">
              <div className="relative w-[220px] h-[220px]">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-teal-400/50 rounded-tl-md" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-teal-400/50 rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-teal-400/50 rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-teal-400/50 rounded-br-md" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-slate-400">Starting camera…</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-semibold text-center"
          style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#FDA4AF', border: '1px solid rgba(244,63,94,0.3)' }}
        >
          {error}
        </div>
      )}

      <p className="text-xs text-center font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
        I-align ang QR code sa loob ng brackets
      </p>

      <div className={`grid gap-3 ${onManualEntry ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {onManualEntry && (
          <button
            onClick={onManualEntry}
            className="flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-2xl active:scale-95 transition-all"
            style={{
              color: '#0A3D38',
              backgroundColor: 'rgba(255,255,255,0.92)',
            }}
          >
            <Keyboard size={15} />
            Manual entry
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-2xl active:scale-95 transition-all disabled:opacity-40"
          style={{
            color: '#0A3D38',
            backgroundColor: 'rgba(255,255,255,0.92)',
          }}
        >
          <ImageUp size={15} />
          {uploading ? 'Reading…' : 'Upload QR image'}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}
