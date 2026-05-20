import { createContext } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
