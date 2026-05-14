import { Account, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetFeeBumpRateLimitForTests,
  checkFeeBumpRateLimit,
  validateInnerTransaction,
} from './fee-bump';

const defaultDestination = Keypair.random().publicKey();

function buildTransactionXdr({
  memo = 'PP:test payment',
  network = Networks.TESTNET,
  sign = true,
  operation = Operation.payment({
    destination: defaultDestination,
    asset: Asset.native(),
    amount: '1.0000000',
  }),
}: {
  memo?: string;
  network?: string;
  sign?: boolean;
  operation?: ReturnType<typeof Operation.payment>;
} = {}): string {
  const source = Keypair.random();
  const tx = new TransactionBuilder(new Account(source.publicKey(), '1'), {
    fee: '100',
    networkPassphrase: network,
  })
    .addOperation(operation)
    .addMemo(Memo.text(memo))
    .setTimeout(30)
    .build();

  if (sign) tx.sign(source);
  return tx.toXDR();
}

afterEach(() => {
  __resetFeeBumpRateLimitForTests();
  delete process.env.FEE_BUMP_ALLOWED_DESTINATIONS;
  delete process.env.FEE_BUMP_RATE_LIMIT_MAX;
  delete process.env.FEE_BUMP_RATE_LIMIT_WINDOW_MS;
  delete process.env.FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.VERCEL_ENV;
});

describe('validateInnerTransaction', () => {
  it('rejects malformed XDR as a validation error', () => {
    expect(() => validateInnerTransaction('not-xdr')).toThrow('invalid innerXdr');
  });

  it('accepts signed PalengkePay native payment transactions on testnet', () => {
    expect(() => validateInnerTransaction(buildTransactionXdr())).not.toThrow();
  });

  it('accepts payment transactions to allowlisted vendor destinations', () => {
    process.env.FEE_BUMP_ALLOWED_DESTINATIONS = defaultDestination;

    expect(() => validateInnerTransaction(buildTransactionXdr())).not.toThrow();
  });

  it('rejects payment transactions to unknown vendor destinations when allowlist is configured', () => {
    process.env.FEE_BUMP_ALLOWED_DESTINATIONS = Keypair.random().publicKey();

    expect(() => validateInnerTransaction(buildTransactionXdr()))
      .toThrow('destination is not approved for sponsorship');
  });

  it('rejects transactions without source signatures', () => {
    expect(() => validateInnerTransaction(buildTransactionXdr({ sign: false })))
      .toThrow('inner transaction must be signed by its source account');
  });

  it('rejects transactions signed for a different network', () => {
    expect(() => validateInnerTransaction(buildTransactionXdr({ network: Networks.PUBLIC })))
      .toThrow('inner transaction must be signed by its source account');
  });

  it('rejects non-PalengkePay memos', () => {
    expect(() => validateInnerTransaction(buildTransactionXdr({ memo: 'market payment' })))
      .toThrow('PalengkePay payment memo required');
  });

  it('rejects unsupported sponsored operations', () => {
    const operation = Operation.manageData({ name: 'unexpected', value: 'payload' });

    expect(() => validateInnerTransaction(buildTransactionXdr({ operation })))
      .toThrow('operation type not sponsored');
  });

  it('rejects destinations outside the sponsorship allow list', () => {
    const destination = Keypair.random().publicKey();
    process.env.FEE_BUMP_ALLOWED_DESTINATIONS = Keypair.random().publicKey();
    const operation = Operation.payment({
      destination,
      asset: Asset.native(),
      amount: '1.0000000',
    });

    expect(() => validateInnerTransaction(buildTransactionXdr({ operation })))
      .toThrow('destination is not approved for sponsorship');
  });
});

describe('checkFeeBumpRateLimit', () => {
  it('enforces an in-memory per-IP request limit for local development', async () => {
    process.env.FEE_BUMP_RATE_LIMIT_MAX = '2';
    process.env.FEE_BUMP_RATE_LIMIT_WINDOW_MS = '1000';

    await expect(checkFeeBumpRateLimit('127.0.0.1', 1_000)).resolves.toMatchObject({ allowed: true, mode: 'memory' });
    await expect(checkFeeBumpRateLimit('127.0.0.1', 1_100)).resolves.toMatchObject({ allowed: true, mode: 'memory' });
    await expect(checkFeeBumpRateLimit('127.0.0.1', 1_200)).resolves.toMatchObject({ allowed: false, mode: 'memory', statusCode: 429 });
    await expect(checkFeeBumpRateLimit('127.0.0.1', 2_001)).resolves.toMatchObject({ allowed: true, mode: 'memory' });
  });

  it('uses durable Upstash-compatible Redis REST counters when configured', async () => {
    process.env.FEE_BUMP_RATE_LIMIT_MAX = '2';
    process.env.FEE_BUMP_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.KV_REST_API_URL = 'https://redis.example';
    process.env.KV_REST_API_TOKEN = 'test-token';
    const fetchMock = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/incr/')) return Response.json({ result: 3 });
      if (url.includes('/expire/')) return Response.json({ result: 1 });
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await checkFeeBumpRateLimit('203.0.113.10', 10_000, fetchMock);

    expect(result).toMatchObject({
      allowed: false,
      mode: 'durable',
      statusCode: 429,
    });
  });

  it('fails closed when production requires durable rate limiting but Redis REST env is missing', async () => {
    process.env.VERCEL_ENV = 'production';

    await expect(checkFeeBumpRateLimit('203.0.113.10', 10_000)).resolves.toMatchObject({
      allowed: false,
      mode: 'unavailable',
      statusCode: 503,
    });
  });
});
