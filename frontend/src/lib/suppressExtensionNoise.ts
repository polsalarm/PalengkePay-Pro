// Filters unhandledrejection events thrown by browser extensions that use
// chrome.runtime.sendMessage with the async-response pattern. Freighter,
// Albedo, MetaMask and password managers inject content scripts that fire
// this when their service worker idle-kills before responding. The error
// originates outside the app bundle and has no functional impact, but
// pollutes the console + Sentry.

const EXTENSION_NOISE_PATTERNS = [
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
  'The message port closed before a response was received',
  'Extension context invalidated',
];

function isExtensionNoise(reason: unknown): boolean {
  const msg = typeof reason === 'string'
    ? reason
    : (reason as { message?: string })?.message ?? '';
  return EXTENSION_NOISE_PATTERNS.some((p) => msg.includes(p));
}

export function installExtensionNoiseFilter() {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (event) => {
    if (isExtensionNoise(event.reason)) {
      event.preventDefault();
    }
  });
  window.addEventListener('error', (event) => {
    if (isExtensionNoise(event.error ?? event.message)) {
      event.preventDefault();
    }
  });
}

export { isExtensionNoise };
