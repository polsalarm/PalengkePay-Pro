import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

const qaWallet = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((wallet) => {
    window.localStorage.clear();
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

  // Income Proof Pack is now opened from a transaction row click rather
  // than rendered inline. Wait for the row, then open the modal before
  // asserting on proof-pack contents.
  const proofRow = page.getByRole('button', { name: /Open income proof pack for this transaction/i }).first();
  await expect(proofRow).toBeVisible({ timeout: 15_000 });
  await proofRow.click();

  const proofModal = page.getByRole('dialog', { name: 'Income Proof Pack' });
  await expect(proofModal).toBeVisible({ timeout: 15_000 });
  await expect(proofModal.getByRole('heading', { name: 'Income Proof Pack' })).toBeVisible();
  await expect(proofModal.getByText(/Exportable vendor proof with source labels and Testnet caveats/i)).toBeVisible();
  await expect(proofModal.getByText(/Testnet exports are demo evidence/i)).toBeVisible();
  await expect(proofModal.getByText(/fallback rows are not the canonical payment contract source/i)).toBeVisible();
  await expect(proofModal.getByText('PHP est.')).toBeVisible();
  await expect(proofModal.getByText('Date range')).toBeVisible();
  await expect(proofModal.getByLabel('Proof readiness checklist').getByText('Payment rows')).toBeVisible();
  await expect(proofModal.getByLabel('Proof readiness checklist').getByText('Live hash')).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /CSV/i })).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /JSON/i })).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /Certificate/i })).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /Print/i })).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /Copy live hash/i })).toBeVisible();
  const certificateDownload = page.waitForEvent('download');
  await proofModal.getByRole('button', { name: /Certificate/i }).click();
  await certificateDownload;
  await expect(proofModal.getByRole('status', { name: /Export status/i })).toContainText(/Certificate export prepared for \d+ transactions?/);
  await expect(proofModal.getByText('PalengkePay Income Proof Certificate')).toBeVisible();
  await expect(proofModal.getByText('Prepared for lender, cooperative, LGU, or aid-program review.')).toBeVisible();
  await expect(proofModal.getByText('Live hash').nth(1)).toBeVisible();
  await expect(proofModal.getByText('qa-vendor-proof-hash').first()).toBeVisible();

  // Close the modal before asserting on underlying page content.
  await proofModal.getByRole('button', { name: 'Close' }).click();
  await expect(proofModal).toBeHidden();

  await expect(page.getByRole('heading', { name: 'Transaction Recovery Desk' })).toBeVisible();
  await expect(page.getByText('Receipt lookup', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Transaction hash: qa-vendor-proof-hash').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: /Check receipt/i })).toBeVisible();
  const rowReceiptLink = page.getByRole('link', { name: /Open receipt qa-vendor-proof-hash/i }).first();
  await expect(rowReceiptLink).toBeVisible();
  const rowReceiptBox = await rowReceiptLink.boundingBox();
  expect(rowReceiptBox?.width).toBeGreaterThanOrEqual(44);
  expect(rowReceiptBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('button', { name: /Share QR again/i })).toBeVisible();
  await expect(page.getByText('Sponsor diagnostics', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Lookup by hash/reference')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use latest/i })).toBeVisible();
  await page.getByRole('button', { name: /Use latest/i }).click();
  await expect(page.getByText('Local receipt reference found.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Copy reference/i })).toBeVisible();
  await page.getByLabel('Lookup by hash/reference').fill('qa-vendor-proof-hash');
  await expect(page.getByText('Transaction hash: qa-vendor-proof-hash').first()).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Lookup by hash/reference').fill('missing-reference');
  await expect(page.getByText(/No local receipt matched/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Clear receipt lookup/i })).toBeVisible();
  await page.getByRole('button', { name: /Clear receipt lookup/i }).click();
  await expect(page.getByText(/Enter a transaction hash, contract payment ID, or local receipt reference/i)).toBeVisible();
  await expect(page.getByLabel('Search receipts')).toBeVisible();
  await page.getByLabel('Search receipts').fill('qa receipt');
  await expect(page.getByText('Transaction hash: qa-vendor-proof-hash').first()).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Search receipts').fill('not-a-real-receipt');
  await expect(page.getByText('No matching receipts')).toBeVisible();
  await page.getByRole('button', { name: /Clear search/i }).click();
  await expect(page.getByText('Transaction hash: qa-vendor-proof-hash').first()).toBeVisible();
  await page.screenshot({
    path: `qa-artifacts/states/${testInfo.project.name}-vendor-transactions-proof-recovery.png`,
    animations: 'disabled',
    fullPage: false,
  });
});

test('/vendor/utang exposes collections reporting summary', async ({ page }) => {
  await page.goto('/vendor/utang');

  await expect(page.getByRole('heading', { name: 'Collections Report' })).toBeVisible();
  await expect(page.getByText(/Summary of active, completed|Buod ng aktibo/i)).toBeVisible();
  await expect(page.getByText('Outstanding')).toBeVisible();
  await expect(page.getByText('Collected')).toBeVisible();
});
