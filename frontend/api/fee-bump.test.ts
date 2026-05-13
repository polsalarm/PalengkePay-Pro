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
  it('enforces an in-memory per-IP request limit', () => {
    process.env.FEE_BUMP_RATE_LIMIT_MAX = '2';
    process.env.FEE_BUMP_RATE_LIMIT_WINDOW_MS = '1000';

    expect(checkFeeBumpRateLimit('127.0.0.1', 1_000)).toBe(true);
    expect(checkFeeBumpRateLimit('127.0.0.1', 1_100)).toBe(true);
    expect(checkFeeBumpRateLimit('127.0.0.1', 1_200)).toBe(false);
    expect(checkFeeBumpRateLimit('127.0.0.1', 2_001)).toBe(true);
  });
});
