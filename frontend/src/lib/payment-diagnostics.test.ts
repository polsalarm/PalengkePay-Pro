import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TxStatusTracker } from '../components/TxStatusTracker';
import { getPaymentFailureDetails } from './payment-diagnostics';

describe('getPaymentFailureDetails', () => {
  it('turns fee-bump sponsor setup failures into actionable diagnostics', () => {
    const details = getPaymentFailureDetails(new Error('Fee bump sponsor not configured'));

    expect(details.message).toBe('Gasless sponsorship is not configured');
    expect(details.diagnostic).toContain('SPONSOR_SECRET');
  });

  it('turns fee-bump rate limits into a retryable diagnostic', () => {
    const details = getPaymentFailureDetails(new Error('Too many fee-bump requests'));

    expect(details.message).toBe('Gasless sponsor is temporarily rate limited');
    expect(details.diagnostic).toContain('Wait a minute');
  });

  it('preserves Horizon operation result codes for failed payments', () => {
    const details = getPaymentFailureDetails({
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: 'tx_failed',
              operations: ['op_underfunded'],
            },
          },
        },
      },
    });

    expect(details.message).toBe('Insufficient XLM balance');
    expect(details.diagnostic).toContain('op_underfunded');
  });

  it('turns malformed fee-bump payloads into a rescan/edit diagnostic', () => {
    const details = getPaymentFailureDetails(new Error('invalid innerXdr'));

    expect(details.message).toBe('Payment request was malformed');
    expect(details.diagnostic).toContain('Re-scan the vendor QR');
  });

  it('truncates unknown long errors for safe display', () => {
    const details = getPaymentFailureDetails(new Error('x'.repeat(260)));

    expect(details.message).toHaveLength(120);
    expect(details.diagnostic).toHaveLength(240);
  });
});

describe('TxStatusTracker failed state', () => {
  it('renders diagnostics with retry, edit, scan, and receipt lookup actions', () => {
    const onRetry = vi.fn();
    const onEdit = vi.fn();
    const onScanAgain = vi.fn();

    const markup = renderToStaticMarkup(React.createElement(TxStatusTracker, {
      status: 'failed',
      txHash: null,
      error: 'Gasless sponsor failed',
      diagnostic: 'Retry once. If it fails again, verify the fee-bump API logs.',
      receiptLookupUrl: 'https://stellar.expert/explorer/testnet/account/GBI5',
      onRetry,
      onEdit,
      onScanAgain,
    }));

    expect(markup).toContain('Transaction failed');
    expect(markup).toContain('Gasless sponsor failed');
    expect(markup).toContain('verify the fee-bump API logs');
    expect(markup).toContain('Retry same payment');
    expect(markup).toContain('Edit details');
    expect(markup).toContain('Scan again');
    expect(markup).toContain('href="https://stellar.expert/explorer/testnet/account/GBI5"');
    expect(onRetry).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onScanAgain).not.toHaveBeenCalled();
  });
});
