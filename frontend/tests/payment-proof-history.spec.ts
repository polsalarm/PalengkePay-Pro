import { expect, test } from '@playwright/test';

const customerWallet = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';
const vendorWallet = 'GCFFUUKXBQK4MCVDBIIKRWWPBP5DPYSQ6YY6LQSI3W5I4GSNQ267VV3B';

test('/customer/history shows preserved PHP receipt proof from signed payments', async ({ page }) => {
  await page.addInitScript(({ customer, vendor }) => {
    window.localStorage.setItem('palengkepay_address', customer);
    window.localStorage.setItem('palengkepay_wallet_name', 'QA Wallet');
    window.localStorage.setItem(`pp_idx_${customer}`, JSON.stringify({
      address: customer,
      cursor: 'now',
      syncedAt: '2026-05-14T01:02:00.000Z',
      payments: [
        {
          id: 'tx-live-hash',
          from: customer,
          to: vendor,
          amountXlm: 20,
          createdAt: '2026-05-14T01:00:30.000Z',
          memo: 'E2E smoke',
        },
      ],
    }));
    window.localStorage.setItem(`pp_payment_proofs_${customer}`, JSON.stringify([
      {
        txHash: 'tx-live-hash',
        from: customer,
        to: vendor,
        amountXlm: 20,
        createdAt: '2026-05-14T01:00:31.000Z',
        memo: 'E2E smoke',
        settlementMode: 'contract',
        quote: {
          phpAmount: 125,
          phpPerXlm: 6.25,
          xlmAmount: '20.0000000',
          generatedAt: '2026-05-14T01:00:00.000Z',
          expiresAt: '2026-05-14T01:01:00.000Z',
          source: 'api',
        },
      },
    ]));
  }, { customer: customerWallet, vendor: vendorWallet });

  await page.goto('/customer/history');

  await expect(page.getByText('E2E smoke')).toBeVisible();
  await expect(page.getByText('₱125.00')).toBeVisible();
  await expect(page.getByText('₱6.25/XLM')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open receipt tx-live-hash/i })).toBeVisible();
});
