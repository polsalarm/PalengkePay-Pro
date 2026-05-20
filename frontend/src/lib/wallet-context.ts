import { createContext } from 'react';

export interface WalletContextValue {
  address: string | null;
  balance: string | null;
  walletName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
  error: string | null;
}

export const WalletContext = createContext<WalletContextValue | null>(null);
