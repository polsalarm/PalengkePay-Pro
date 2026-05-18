import { bytesToHex } from './stellar';

const COMMENT_PREFIX = 'pp_rcmt_';
const ZERO_HASH_HEX = '0'.repeat(64);

/** SHA-256 of a UTF-8 string. Returns 64-char lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(buf));
}

export function zeroCommentHashHex(): string {
  return ZERO_HASH_HEX;
}

export function isZeroHash(hex: string): boolean {
  return /^0+$/.test(hex);
}

/** Stores comment body locally keyed by its hash. Off-chain readability only — moves to backend KV later. */
export function storeCommentLocally(commentHash: string, body: string) {
  try {
    localStorage.setItem(COMMENT_PREFIX + commentHash, body);
  } catch { /* quota — skip */ }
}

export function readCommentLocally(commentHash: string): string | null {
  if (isZeroHash(commentHash)) return null;
  try {
    return localStorage.getItem(COMMENT_PREFIX + commentHash);
  } catch {
    return null;
  }
}

export interface RatingSummary {
  sum: number;
  count: number;
  average: number;
}

export function summarize(sum: number, count: number): RatingSummary {
  return {
    sum,
    count,
    average: count > 0 ? sum / count : 0,
  };
}
