/** Strip HTML tags and trim. Use on all user-supplied string inputs before storing or displaying. */
export function sanitizeText(value: string, maxLen = 200): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    .trim()
    .slice(0, maxLen);
}

/** Validate a Stellar public address (G... 56 chars). */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address.trim());
}

/** Validate a positive XLM amount string (max 7 decimal places). */
export function isValidXlmAmount(value: string): boolean {
  return /^\d+(\.\d{1,7})?$/.test(value.trim()) && parseFloat(value) > 0;
}

/** Sanitize memo field: ASCII printable, max 28 chars (Stellar memo limit). */
export function sanitizeMemo(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, 28);
}
