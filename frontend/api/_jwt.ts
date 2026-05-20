/**
 * Minimal HS256 JWT helper for SEP-10 session tokens.
 * Avoids pulling in jsonwebtoken — the SEP-10 spec only needs HS256.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.ANCHOR_JWT_SECRET ?? process.env.ANCHOR_SIGNING_SECRET ?? 'palengkepay-dev-secret-change-me';

export interface SepJwtPayload {
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  jti?: string;
  client_domain?: string;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function signJwt(payload: SepJwtPayload): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = b64url(createHmac('sha256', SECRET).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyJwt(token: string): SepJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = b64url(createHmac('sha256', SECRET).update(data).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as SepJwtPayload;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
