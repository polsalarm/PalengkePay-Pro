import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

const qaWallet = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((wallet) => {
    window.localStorage.setItem('palengkepay_address', wallet);
    window.localStorage.setItem('palengkepay_wallet_name', 'QA Wallet');
    window.localStorage.setItem(`pp_idx_${wallet}`, JSON.stringify({
      address: wallet,
      cursor: 'now',
      syncedAt: '2026-05-14T01:00:00.000Z',
      payments: [
        {
          id: 'qa-vendor-proof-hash',
          from: 'GCUSTOMERQA00000000000000000000000000000000000000000000',
          to: wallet,
          amountXlm: 4.25,
          createdAt: '2026-05-14T01:00:00.000Z',
          memo: 'qa receipt',
        },
      ],
    }));
  }, qaWallet);
});

test('/vendor/transactions exposes income proof exports, recovery, and caveats', async ({ page }, testInfo) => {
  await fs.mkdir('qa-artifacts/states', { recursive: true });
  await page.goto('/vendor/transactions');

  await expect(page.getByRole('heading', { name: 'Income Proof Pack' })).toBeVisible();
  await expect(page.getByText(/Exportable vendor proof with source labels and Testnet caveats/i)).toBeVisible();
  await expect(page.getByText(/Testnet exports are demo evidence/i)).toBeVisible();
  await expect(page.getByText(/fallback rows are not the canonical payment contract source/i)).toBeVisible();
  await expect(page.getByText('PHP est.')).toBeVisible();
  await expect(page.getByText('Date range')).toBeVisible();
  await expect(page.getByRole('button', { name: /CSV/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /JSON/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Print/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Transaction Recovery Desk' })).toBeVisible();
  await expect(page.getByText('Receipt lookup', { exact: true })).toBeVisible();
  await expect(page.getByText('qa-vendor-proof-hash')).toBeVisible();
  await expect(page.getByRole('link', { name: /Check receipt/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Share QR again/i })).toBeVisible();
  await expect(page.getByText('Sponsor diagnostics', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Search receipts')).toBeVisible();
  await page.getByLabel('Search receipts').fill('qa receipt');
  await expect(page.getByText('qa-vendor-proof-hash')).toBeVisible();
  await page.getByLabel('Search receipts').fill('not-a-real-receipt');
  await expect(page.getByText('No matching receipts')).toBeVisible();
  await page.getByRole('button', { name: /Clear search/i }).click();
  await expect(page.getByText('qa-vendor-proof-hash')).toBeVisible();
  await page.screenshot({
    path: `qa-artifacts/states/${testInfo.project.name}-vendor-transactions-proof-recovery.png`,
    fullPage: true,
  });
});

test('/vendor/utang exposes collections reporting summary', async ({ page }) => {
  await page.goto('/vendor/utang');

  await expect(page.getByRole('heading', { name: 'Collections Report' })).toBeVisible();
  await expect(page.getByText(/Summary of active, completed|Buod ng aktibo/i)).toBeVisible();
  await expect(page.getByText('Outstanding')).toBeVisible();
  await expect(page.getByText('Collected')).toBeVisible();
});
