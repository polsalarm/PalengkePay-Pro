export interface VendorQrPayload {
  t: 'p';
  v: 1;
  a: string;
  n: string;
  s: string;
}

export interface VendorQrMeta {
  address: string;
  name?: string;
  stallInfo?: string;
}

export function buildVendorQrPayload(address: string, vendorName?: string, stallInfo?: string): string {
  if (!vendorName) return address;
  return JSON.stringify({
    t: 'p',
    v: 1,
    a: address,
    n: vendorName,
    s: stallInfo ?? '',
  } satisfies VendorQrPayload);
}

export function parseVendorQrPayload(raw: string): VendorQrMeta | null {
  try {
    const parsed = JSON.parse(raw) as Partial<VendorQrPayload>;
    if (typeof parsed.a !== 'string' || !parsed.a.startsWith('G') || parsed.a.length !== 56) {
      return null;
    }
    return {
      address: parsed.a,
      name: typeof parsed.n === 'string' && parsed.n ? parsed.n : undefined,
      stallInfo: typeof parsed.s === 'string' && parsed.s ? parsed.s : undefined,
    };
  } catch {
    return null;
  }
}
