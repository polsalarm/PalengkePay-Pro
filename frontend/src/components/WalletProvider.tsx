import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { WalletContext } from '../lib/wallet-context';
import { NETWORK_PASSPHRASE } from '../lib/stellar';
import { initKit, loadWalletKit, isWalletKitLoaded } from '../lib/wallet-kit';
import { useToast } from '../lib/hooks/useToast';

// WalletConnect's relay publish can time out when the tab is backgrounded —
// which is exactly what happens on mobile web when the browser switches to
// the wallet app to approve and back. Matches the SDK's own error text
// ("Failed to publish custom payload...") so a retry is only auto-armed for
// this specific, recoverable failure mode, not e.g. "wallet not installed".
function isRelayPublishFailure(message: string): boolean {
  return /publish|relay/i.test(message);
}

function getStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [address, setAddress] = useState<string | null>(() => getStoredValue('palengkepay_address'));
  const [balance, setBalance] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(() => getStoredValue('palengkepay_wallet_name'));
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once when a connect failure looks like a backgrounded-tab relay
  // timeout — consumed by the visibilitychange retry below, then cleared
  // either way so a real re-failure doesn't loop.
  const retryArmedRef = useRef(false);

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

  const connect = useCallback(async (isRetry = false): Promise<string | null> => {
    setIsConnecting(true);
    if (!isRetry) setError(null);
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
      retryArmedRef.current = false;
      return addr;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Connection failed';
      if (!msg.includes('close') && !msg.includes('Cancel') && !msg.includes('cancel')) {
        setError(msg);
        if (isRelayPublishFailure(msg)) {
          retryArmedRef.current = true;
        } else {
          showToast('Wallet connection failed. Tap Connect Wallet to try again.', 'error');
        }
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalance, showToast]);

  // Mobile WalletConnect: approving switches away to the wallet app, which
  // backgrounds this tab mid-handshake and can time out the relay publish.
  // Retry once automatically when the user switches back, so the connect
  // they already asked for actually completes instead of silently dying.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible' || !retryArmedRef.current || address) return;
      retryArmedRef.current = false;
      connect(true).then((addr) => {
        if (!addr) {
          showToast("Still couldn't connect — tap Connect Wallet to try again.", 'error');
        }
      });
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [connect, address, showToast]);

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
