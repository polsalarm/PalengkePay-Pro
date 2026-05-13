import { describe, expect, it } from 'vitest';
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
});
