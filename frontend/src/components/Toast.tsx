import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
const MAX_TOASTS = 3;

const TOAST_CONFIG: Record<ToastType, {
  bg: string; border: string; iconColor: string;
  iconBg: string; textColor: string; actionBg: string; actionColor: string;
}> = {
  success: {
    bg: '#00284B', border: 'rgba(20,184,166,0.3)',
    iconColor: '#4ADE80', iconBg: 'rgba(74,222,128,0.15)',
    textColor: 'white', actionBg: 'rgba(74,222,128,0.15)', actionColor: '#4ADE80',
  },
  error: {
    bg: '#1C0A0E', border: 'rgba(244,63,94,0.35)',
    iconColor: '#FB7185', iconBg: 'rgba(244,63,94,0.15)',
    textColor: 'white', actionBg: 'rgba(244,63,94,0.15)', actionColor: '#FB7185',
  },
  warning: {
    bg: '#1C1200', border: 'rgba(245,158,11,0.35)',
    iconColor: '#FCD34D', iconBg: 'rgba(245,158,11,0.15)',
    textColor: 'white', actionBg: 'rgba(245,158,11,0.15)', actionColor: '#FCD34D',
  },
  info: {
    bg: '#0F1629', border: 'rgba(99,102,241,0.3)',
    iconColor: '#818CF8', iconBg: 'rgba(99,102,241,0.15)',
    textColor: 'white', actionBg: 'rgba(99,102,241,0.15)', actionColor: '#818CF8',
  },
};

const TOAST_ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
    const id = ++counter;
    setToasts((prev) => {
      const next = [...prev, { id, type, message, action }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
        style={{ zIndex: 9999 }}
      >
        {toasts.map((toast) => {
          const cfg = TOAST_CONFIG[toast.type];
          const Icon = TOAST_ICONS[toast.type];
          return (
            <div
              key={toast.id}
              className="flex items-center gap-3 px-4 py-3.5 pointer-events-auto animate-toast"
              style={{
                backgroundColor: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 18,
                boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: cfg.iconBg }}
              >
                <Icon size={15} style={{ color: cfg.iconColor }} />
              </div>

              {/* Message */}
              <span
                className="text-sm font-semibold flex-1 leading-snug"
                style={{ color: cfg.textColor }}
              >
                {toast.message}
              </span>

              {/* Action button */}
              {toast.action && (
                <button
                  onClick={() => { toast.action!.onClick(); dismiss(toast.id); }}
                  className="shrink-0 text-xs font-black px-2.5 py-1 rounded-lg active:scale-95 transition-all"
                  style={{ backgroundColor: cfg.actionBg, color: cfg.actionColor }}
                >
                  {toast.action.label}
                </button>
              )}

              {/* Dismiss */}
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 active:scale-95 transition-opacity ml-0.5"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
