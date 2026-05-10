import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download } from 'lucide-react';

interface Props {
  value: string;
  size?: number;
  vendorName?: string;
  stallInfo?: string;
  downloadable?: boolean;
}

export function QRGenerator({ value, size = 240, vendorName, stallInfo, downloadable = false }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const qrValue = vendorName
    ? JSON.stringify({ a: value, n: vendorName, s: stallInfo ?? '' })
    : value;

  function handleDownload() {
    const canvas = wrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `palengkepay-qr-${vendorName?.replace(/\s+/g, '-').toLowerCase() ?? 'vendor'}.png`;
    link.click();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={wrapperRef} className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
        <QRCodeCanvas
          value={qrValue}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#0f172a"
        />
      </div>
      {vendorName && (
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{vendorName}</p>
          {stallInfo && <p className="text-sm text-slate-500 mt-0.5">{stallInfo}</p>}
          <p className="text-xs text-slate-400 mt-1">Scan to pay me</p>
        </div>
      )}
      {downloadable && (
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-5 py-2.5 rounded-xl transition-colors"
        >
          <Download size={15} />
          Save QR Code
        </button>
      )}
    </div>
  );
}
