export interface PaymentFailureDetails {
  message: string;
  diagnostic: string | null;
}

type HorizonError = {
  response?: {
    data?: {
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };
    };
  };
};

export function getPaymentFailureDetails(err: unknown): PaymentFailureDetails {
  if (!err) return { message: 'Unknown error', diagnostic: null };

  const rc = (err as HorizonError).response?.data?.extras?.result_codes;
  if (rc) {
    const tx = rc.transaction;
    const ops = rc.operations ?? [];
    const diagnostic = `Stellar result codes: ${[tx, ...ops].filter(Boolean).join(', ')}`;

    if (tx === 'tx_bad_seq') return { message: 'Sequence error — please try again', diagnostic };
    if (tx === 'tx_insufficient_fee') return { message: 'Network fee too low — please try again', diagnostic };
    if (tx === 'tx_bad_auth') return { message: 'Invalid signature — reconnect wallet', diagnostic };
    if (ops.includes('op_no_destination')) return { message: 'Vendor account not activated on Stellar testnet', diagnostic };
    if (ops.includes('op_underfunded')) return { message: 'Insufficient XLM balance', diagnostic };
    if (ops.includes('op_low_reserve')) return { message: 'Account below minimum XLM reserve', diagnostic };

    return { message: `Transaction failed: ${tx ?? ops.join(', ') ?? 'unknown'}`, diagnostic };
  }

  const raw = (err as { message?: string }).message ?? String(err);
  const lower = raw.toLowerCase();

  if (raw.includes('Fee bump sponsor not configured')) {
    return {
      message: 'Gasless sponsorship is not configured',
      diagnostic: 'Set SPONSOR_SECRET on the fee-bump API environment, then retry the payment.',
    };
  }

  if (raw.includes('Too many fee-bump requests')) {
    return {
      message: 'Gasless sponsor is temporarily rate limited',
      diagnostic: 'Wait a minute, then retry. If this keeps happening, raise FEE_BUMP_RATE_LIMIT_MAX.',
    };
  }

  if (raw.includes('innerXdr required') || raw.includes('invalid innerXdr')) {
    return {
      message: 'Payment request was malformed',
      diagnostic: 'Re-scan the vendor QR or re-enter the payment details before retrying.',
    };
  }

  if (raw.includes('destination is not approved for sponsorship')) {
    return {
      message: 'Vendor is not approved for sponsored payments',
      diagnostic: 'Add this vendor wallet to FEE_BUMP_ALLOWED_DESTINATIONS or use an approved vendor.',
    };
  }

  if (raw.includes('Fee bump failed')) {
    return {
      message: 'Gasless sponsor failed',
      diagnostic: 'Retry once. If it fails again, verify the fee-bump API logs and sponsor account balance.',
    };
  }

  if (lower.includes('rejected') || lower.includes('cancel') || lower.includes('denied')) {
    return { message: 'Transaction cancelled — no funds sent', diagnostic: null };
  }
  if (lower.includes('network')) {
    return { message: 'Please switch to Stellar Testnet', diagnostic: raw.slice(0, 160) };
  }
  if (lower.includes('balance') || lower.includes('insufficient')) {
    return { message: 'Insufficient XLM balance', diagnostic: raw.slice(0, 160) };
  }
  if (lower.includes('timeout')) {
    return { message: 'Transaction timed out — tap retry to resend', diagnostic: raw.slice(0, 160) };
  }

  return { message: raw.slice(0, 120), diagnostic: raw.length > 120 ? raw.slice(0, 240) : null };
}
