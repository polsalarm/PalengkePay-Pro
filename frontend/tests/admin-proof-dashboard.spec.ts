import { expect, test } from '@playwright/test';

const customerWallet = 'GCUSTOMER000000000000000000000000000000000000000000000';
const vendorWallet = 'GVENDOR00000000000000000000000000000000000000000000000';

test('/admin/proofs shows smoke proof status, receipts, source mix, and sponsor status', async ({ page }) => {
  await page.addInitScript(({ customer, vendor }) => {
    const proof = {
      txHash: 'tx-live-hash',
      from: customer,
      to: vendor,
      amountXlm: 20,
      createdAt: '2026-05-14T01:00:30.000Z',
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
    };
    window.localStorage.setItem(`pp_payment_proofs_${customer}`, JSON.stringify([proof]));
    window.localStorage.setItem(`pp_payment_proofs_${vendor}`, JSON.stringify([proof]));
  }, { customer: customerWallet, vendor: vendorWallet });

  await page.goto('/admin/proofs');

  await expect(page.getByRole('heading', { name: 'Proof Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Testnet Payment Smoke Flow' })).toBeVisible();
  await expect(page.getByText('Hash captured')).toBeVisible();
  await expect(page.getByText('tx-live-hash').first()).toBeVisible();
  await expect(page.getByText('Recent Receipts')).toBeVisible();
  await expect(page.getByText('Contract rows')).toBeVisible();
  await expect(page.getByText('Sponsor', { exact: true })).toBeVisible();
});
