import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { WalletContext } from '../lib/wallet-context';
import { NETWORK_PASSPHRASE } from '../lib/stellar';
import { initKit, loadWalletKit, isWalletKitLoaded } from '../lib/wallet-kit';

function getStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => getStoredValue('palengkepay_address'));
  const [balance, setBalance] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(() => getStoredValue('palengkepay_wallet_name'));
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const { fetchBalance } = await import('../lib/stellar');
      const bal = await fetchBalance(addr);
      setBalance(bal);
    } catch {
      setBalance(null);
    }
  }, []);

  // Initialize the wallet kit on mount so direct StellarWalletsKit.signTransaction
  // calls (utang, payments, ratings, status toggles) work after a page reload
  // where the user has a cached address but has not invoked connect() this session.
  useEffect(() => {
    initKit().catch((err) => console.warn('[wallet] initKit failed:', err));
  }, []);

  useEffect(() => {
    if (address) refreshBalance(address);
  }, [address, refreshBalance]);

  const connect = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    setError(null);
    try {
      await initKit();
      const { StellarWalletsKit } = await loadWalletKit();
      const result = await StellarWalletsKit.authModal() as { address: string; name?: string };
      const addr = result.address;
      const name = result.name ?? null;
      // Persist address BEFORE the optional sign-in challenge so a flaky
      // second signature on mobile (iOS Safari Albedo, WalletConnect deeplink
      // return) does not block the connect flow. authModal itself already
      // proves wallet ownership.
      setAddress(addr);
      setWalletName(name);
      localStorage.setItem('palengkepay_address', addr);
      if (name) localStorage.setItem('palengkepay_wallet_name', name);
      try {
        await StellarWalletsKit.signMessage('Sign in to PalengkePay', { address: addr });
      } catch (signErr) {
        // Non-fatal: some wallets/contexts (mobile WalletConnect round-trip,
        // Albedo iOS) reject or silently fail the second prompt. The user is
        // already authenticated via authModal; keep them connected.
        console.warn('[wallet] sign-in challenge skipped:', signErr);
      }
      await refreshBalance(addr);
      return addr;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Connection failed';
      if (!msg.includes('close') && !msg.includes('Cancel') && !msg.includes('cancel')) {
        setError(msg);
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalance]);

  const disconnect = useCallback(async () => {
    try {
      if (isWalletKitLoaded()) {
        const { StellarWalletsKit } = await loadWalletKit();
        await StellarWalletsKit.disconnect();
      }
    } catch {
      // ignore
    }
    setAddress(null);
    setBalance(null);
    setWalletName(null);
    localStorage.removeItem('palengkepay_address');
    localStorage.removeItem('palengkepay_wallet_name');
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    if (!address) throw new Error('Wallet not connected');
    await initKit();
    const { StellarWalletsKit } = await loadWalletKit();
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    return signedTxXdr;
  }, [address]);

  return (
    <WalletContext.Provider value={{
      address,
      balance,
      walletName,
      isConnected: !!address,
      isConnecting,
      connect,
      disconnect,
      signTransaction,
      error,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
