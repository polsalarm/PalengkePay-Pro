import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair, Networks, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

const PALENGKEPAY_MEMO_PREFIX = 'PP:';
const DEFAULT_MAX_INNER_XDR_BYTES = 20_000;
const DEFAULT_MAX_INNER_FEE_STROOPS = 1_000;
const DEFAULT_MAX_SPONSORED_OPS = 1;
const DEFAULT_MAX_SPONSORED_XLM = 100;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 20;

interface SponsoredOperation {
  type: string;
  source?: string;
  destination?: string;
  asset?: { isNative?: () => boolean };
  amount?: string;
  startingBalance?: string;
}

interface MemoLike {
  _type?: string;
  _value?: unknown;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export class FeeBumpValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'FeeBumpValidationError';
    this.statusCode = statusCode;
  }
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getClientIp(req: VercelRequest): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return firstForwarded?.split(',')[0]?.trim()
    ?? (req.headers['x-real-ip'] as string | undefined)
    ?? req.socket.remoteAddress
    ?? 'unknown';
}

export function checkFeeBumpRateLimit(clientIp: string, now = Date.now()): boolean {
  const windowMs = envNumber('FEE_BUMP_RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMIT_WINDOW_MS);
  const maxRequests = envNumber('FEE_BUMP_RATE_LIMIT_MAX', DEFAULT_RATE_LIMIT_MAX);
  const bucket = rateLimitBuckets.get(clientIp);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(clientIp, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) return false;
  bucket.count += 1;
  return true;
}

export function __resetFeeBumpRateLimitForTests(): void {
  rateLimitBuckets.clear();
}

function getMemoText(tx: Transaction): string | null {
  const memo = tx.memo as MemoLike | undefined;
  if (memo?._type !== 'text') return null;
  if (typeof memo._value === 'string') return memo._value;
  if (Buffer.isBuffer(memo._value)) return memo._value.toString('utf8');
  return null;
}

function verifySourceSignature(tx: Transaction): boolean {
  const sourceKeypair = Keypair.fromPublicKey(tx.source);
  const sourceHint = Buffer.from(sourceKeypair.rawPublicKey()).subarray(-4);
  return tx.signatures.some((signature) => {
    const hint = Buffer.from(signature.hint());
    if (!hint.equals(sourceHint)) return false;
    return sourceKeypair.verify(tx.hash(), signature.signature());
  });
}

function parsePositiveNumber(value: string | undefined, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new FeeBumpValidationError(`${fieldName} must be positive`);
  }
  return parsed;
}

function getAllowedDestinations(): Set<string> | null {
  const raw = process.env.FEE_BUMP_ALLOWED_DESTINATIONS;
  if (!raw?.trim()) return null;
  return new Set(
    raw
      .split(',')
      .map((destination) => destination.trim())
      .filter(Boolean),
  );
}

function validateDestination(destination: string | undefined): void {
  if (!destination) {
    throw new FeeBumpValidationError('destination required for sponsored operation');
  }

  try {
    Keypair.fromPublicKey(destination);
  } catch {
    throw new FeeBumpValidationError('invalid sponsored operation destination');
  }

  const allowedDestinations = getAllowedDestinations();
  if (allowedDestinations && !allowedDestinations.has(destination)) {
    throw new FeeBumpValidationError('destination is not approved for sponsorship');
  }
}

function validateOperation(operation: SponsoredOperation, txSource: string): void {
  if (operation.source && operation.source !== txSource) {
    throw new FeeBumpValidationError('operation source must match transaction source');
  }

  if (operation.type === 'payment') {
    validateDestination(operation.destination);
    if (!operation.asset?.isNative?.()) {
      throw new FeeBumpValidationError('only native XLM payments can be sponsored');
    }
    const amount = parsePositiveNumber(operation.amount, 'payment amount');
    const maxAmount = envNumber('FEE_BUMP_MAX_SPONSORED_XLM', DEFAULT_MAX_SPONSORED_XLM);
    if (amount > maxAmount) {
      throw new FeeBumpValidationError('payment amount exceeds sponsorship limit');
    }
    return;
  }

  if (operation.type === 'createAccount') {
    validateDestination(operation.destination);
    const startingBalance = parsePositiveNumber(operation.startingBalance, 'starting balance');
    const maxAmount = envNumber('FEE_BUMP_MAX_SPONSORED_XLM', DEFAULT_MAX_SPONSORED_XLM);
    if (startingBalance > maxAmount) {
      throw new FeeBumpValidationError('starting balance exceeds sponsorship limit');
    }
    return;
  }

  throw new FeeBumpValidationError(`operation type not sponsored: ${operation.type}`);
}

export function validateInnerTransaction(innerXdr: string): Transaction {
  const maxXdrBytes = envNumber('FEE_BUMP_MAX_INNER_XDR_BYTES', DEFAULT_MAX_INNER_XDR_BYTES);
  if (Buffer.byteLength(innerXdr, 'utf8') > maxXdrBytes) {
    throw new FeeBumpValidationError('innerXdr too large', 413);
  }

  let parsed;
  try {
    parsed = TransactionBuilder.fromXDR(innerXdr, Networks.TESTNET);
  } catch {
    throw new FeeBumpValidationError('invalid innerXdr');
  }

  if (!(parsed instanceof Transaction)) {
    throw new FeeBumpValidationError('fee-bump transactions cannot be nested');
  }

  try {
    Keypair.fromPublicKey(parsed.source);
  } catch {
    throw new FeeBumpValidationError('invalid transaction source');
  }

  if (!verifySourceSignature(parsed)) {
    throw new FeeBumpValidationError('inner transaction must be signed by its source account');
  }

  const memoText = getMemoText(parsed);
  if (!memoText?.startsWith(PALENGKEPAY_MEMO_PREFIX)) {
    throw new FeeBumpValidationError('PalengkePay payment memo required');
  }

  const maxFee = envNumber('FEE_BUMP_MAX_INNER_FEE_STROOPS', DEFAULT_MAX_INNER_FEE_STROOPS);
  const innerFee = Number(parsed.fee);
  if (!Number.isFinite(innerFee) || innerFee <= 0 || innerFee > maxFee) {
    throw new FeeBumpValidationError('inner transaction fee exceeds sponsorship policy');
  }

  const maxOps = envNumber('FEE_BUMP_MAX_SPONSORED_OPS', DEFAULT_MAX_SPONSORED_OPS);
  if (parsed.operations.length === 0 || parsed.operations.length > maxOps) {
    throw new FeeBumpValidationError('unsupported sponsored operation count');
  }

  parsed.operations.forEach((operation) => validateOperation(operation as SponsoredOperation, parsed.source));

  return parsed;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { innerXdr } = (req.body ?? {}) as { innerXdr?: string };
  if (typeof innerXdr !== 'string' || !innerXdr.trim()) {
    return res.status(400).json({ error: 'innerXdr required' });
  }

  if (!checkFeeBumpRateLimit(getClientIp(req))) {
    return res.status(429).json({ error: 'Too many fee-bump requests' });
  }

  const sponsorSecret = process.env.SPONSOR_SECRET;
  if (!sponsorSecret) return res.status(500).json({ error: 'Fee bump sponsor not configured' });

  try {
    const sponsorKeypair = Keypair.fromSecret(sponsorSecret);
    const innerTx = validateInnerTransaction(innerXdr);

    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      '10000',
      innerTx,
      Networks.TESTNET,
    );
    feeBump.sign(sponsorKeypair);

    return res.status(200).json({ feeBumpXdr: feeBump.toXDR() });
  } catch (err: unknown) {
    const statusCode = err instanceof FeeBumpValidationError ? err.statusCode : 500;
    return res.status(statusCode).json({ error: (err as Error).message ?? 'Fee bump failed' });
  }
}
