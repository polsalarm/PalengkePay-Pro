import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

const customerWallet = 'GCUSTOMER000000000000000000000000000000000000000000000';
const vendorWallet = 'GVENDOR00000000000000000000000000000000000000000000000';

test('standalone receipt route restores saved wallet proof by transaction hash', async ({ page }, testInfo) => {
  await page.addInitScript(({ customer, vendor }) => {
    window.localStorage.setItem(`pp_payment_proofs_${customer}`, JSON.stringify([
      {
        txHash: 'tx-live-hash',
        from: customer,
        to: vendor,
        amountXlm: 20,
        memo: 'E2E smoke',
        createdAt: '2026-05-14T01:00:31.000Z',
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

  await page.goto('/receipt/tx-live-hash');

  await expect(page.getByRole('heading', { name: 'Payment receipt' })).toBeVisible();
  await expect(page.getByText('Wallet-signed Testnet proof saved on this device')).toBeVisible();
  await expect(page.getByText('₱125.00')).toBeVisible();
  await expect(page.getByText('20 XLM')).toBeVisible();
  await expect(page.getByText('tx-live-hash')).toBeVisible();
  await expect(page.getByRole('link', { name: /Verify on Stellar Expert/i })).toBeVisible();

  await fs.mkdir('qa-artifacts/states', { recursive: true });
  await page.screenshot({
    path: `qa-artifacts/states/${testInfo.project.name}-receipt-proof.png`,
    fullPage: true,
  });
});
