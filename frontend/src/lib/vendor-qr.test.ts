import { describe, expect, it } from 'vitest';
import { buildVendorQrPayload, parseVendorQrPayload } from './vendor-qr';

const vendorWallet = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

describe('vendor QR payloads', () => {
  it('builds a versioned payment QR payload with vendor metadata', () => {
    const raw = buildVendorQrPayload(vendorWallet, 'Aling Nena', 'Stall 12 - Gulay');

    expect(JSON.parse(raw)).toEqual({
      t: 'p',
      v: 1,
      a: vendorWallet,
      n: 'Aling Nena',
      s: 'Stall 12 - Gulay',
    });
    expect(parseVendorQrPayload(raw)).toEqual({
      address: vendorWallet,
      name: 'Aling Nena',
      stallInfo: 'Stall 12 - Gulay',
    });
  });

  it('keeps plain address QR compatibility when no vendor profile is provided', () => {
    expect(buildVendorQrPayload(vendorWallet)).toBe(vendorWallet);
    expect(parseVendorQrPayload(vendorWallet)).toBeNull();
  });
});
