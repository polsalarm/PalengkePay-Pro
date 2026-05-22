import { IS_MAINNET } from './stellar';

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

function getWalletConnectOrigin(): string {
  if (typeof window === 'undefined') return 'https://palengke-pay.vercel.app';
  return window.location.origin;
}

let kitInitPromise: Promise<void> | null = null;
let walletKitPromise: Promise<typeof import('@creit.tech/stellar-wallets-kit')> | null = null;

export function loadWalletKit() {
  walletKitPromise ??= import('@creit.tech/stellar-wallets-kit');
  return walletKitPromise;
}

// Lazy-init the kit on first call. Safe to call repeatedly — the promise is
// memoized so concurrent callers share one init pass.
export function initKit(): Promise<void> {
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

export function isWalletKitLoaded(): boolean {
  return walletKitPromise !== null;
}
