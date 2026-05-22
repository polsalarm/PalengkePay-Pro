import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { WalletContext } from '../lib/wallet-context';
import { IS_MAINNET, NETWORK_PASSPHRASE } from '../lib/stellar';

// Inline SVG data URIs — no external image fetch, never broken
const ICONS: Record<string, string> = {
  freighter:    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='8' fill='%234F46E5'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui' font-weight='700' font-size='16' fill='white'%3EF%3C/text%3E%3C/svg%3E",
  wallet_connect:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='8' fill='%23008055'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui' font-weight='700' font-size='16' fill='white'%3EW%3C/text%3E%3C/svg%3E",
  xbull:        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='8' fill='%23042E80'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui' font-weight='700' font-size='16' fill='white'%3EX%3C/text%3E%3C/svg%3E",
  albedo:       "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='8' fill='%23D97706'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui' font-weight='700' font-size='16' fill='white'%3EA%3C/text%3E%3C/svg%3E",
  lobstr:       "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='8' fill='%230EA5E9'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='system-ui' font-weight='700' font-size='16' fill='white'%3EL%3C/text%3E%3C/svg%3E",
};

function patchIcon(mod: { productIcon?: string; productId?: string }) {
  const id = mod.productId ?? '';
  if (ICONS[id]) mod.productIcon = ICONS[id];
}

// WalletConnect loaded via dynamic import — avoids @reown/appkit circular dep
// crash during bundle evaluation in production builds
let kitInitPromise: Promise<void> | null = null;
let walletKitPromise: Promise<typeof import('@creit.tech/stellar-wallets-kit')> | null = null;

function loadWalletKit() {
  walletKitPromise ??= import('@creit.tech/stellar-wallets-kit');
  return walletKitPromise;
}

function getStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function getWalletConnectOrigin(): string {
  if (typeof window === 'undefined') return 'https://palengke-pay.vercel.app';
  return window.location.origin;
}

function initKit(): Promise<void> {
  if (!kitInitPromise) {
    kitInitPromise = Promise.all([
      loadWalletKit(),
      import('@creit.tech/stellar-wallets-kit/modules/freighter'),
      import('@creit.tech/stellar-wallets-kit/modules/lobstr'),
      import('@creit.tech/stellar-wallets-kit/modules/xbull'),
      import('@creit.tech/stellar-wallets-kit/modules/albedo'),
      import('@creit.tech/stellar-wallets-kit/modules/wallet-connect'),
    ]).then(
      ([
        { StellarWalletsKit, Networks },
        { FreighterModule },
        { LobstrModule },
        { xBullModule },
        { AlbedoModule },
        { WalletConnectModule, WalletConnectTargetChain },
      ]) => {
        const origin = getWalletConnectOrigin();
        const wcMod = new WalletConnectModule({
          projectId: 'c7916523a37cc092c33241c5bf3efcbd',
          metadata: {
            name: 'PalengkePay',
            description: 'Stellar micropayments for Philippine wet market vendors',
            url: origin,
            icons: [`${origin}/icon-192.svg`],
          },
          allowedChains: [IS_MAINNET ? WalletConnectTargetChain.PUBLIC : WalletConnectTargetChain.TESTNET],
        });
        const freighterMod = new FreighterModule();
        const lobstrMod    = new LobstrModule();
        const xbullMod     = new xBullModule();
        const albedoMod    = new AlbedoModule();

        [wcMod, freighterMod, lobstrMod, xbullMod, albedoMod].forEach(patchIcon);

        StellarWalletsKit.init({
          network: IS_MAINNET ? Networks.PUBLIC : Networks.TESTNET,
          modules: [wcMod, freighterMod, lobstrMod, xbullMod, albedoMod],
        });
      }
    );
  }
  return kitInitPromise;
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
      await StellarWalletsKit.signMessage('Sign in to PalengkePay', { address: addr });
      setAddress(addr);
      setWalletName(name);
      localStorage.setItem('palengkepay_address', addr);
      if (name) localStorage.setItem('palengkepay_wallet_name', name);
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
      if (walletKitPromise) {
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
