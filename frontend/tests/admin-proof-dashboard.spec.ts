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

  await expect(page.getByRole('heading', { name: 'Proof Dashboard' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Testnet Payment Smoke Flow' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Hash captured')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('tx-live-hash').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Copy hash/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Proof review links' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Receipt page/i })).toHaveAttribute('href', '/receipt/tx-live-hash');
  await expect(page.getByRole('link', { name: /Vendor certificate/i })).toHaveAttribute('href', '/vendor/transactions');
  await expect(page.getByText('Recent Receipts')).toBeVisible();
  await expect(page.getByText('Contract rows')).toBeVisible();
  await expect(page.getByText('Sponsor', { exact: true })).toBeVisible();
});

test('/admin/proofs gives clear next steps before a real smoke hash exists', async ({ page }) => {
  await page.goto('/admin/proofs');

  await expect(page.getByRole('heading', { name: 'Proof Dashboard' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Needs real hash')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manual smoke payment required' })).toBeVisible();
  await expect(page.getByText(/Make one wallet-signed Testnet payment, refresh this dashboard/i)).toBeVisible();
  await expect(page.getByRole('status', { name: /Proof dashboard status/i })).toBeVisible();
});
