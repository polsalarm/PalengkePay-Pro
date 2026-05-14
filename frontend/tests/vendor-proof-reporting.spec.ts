import { expect, test } from '@playwright/test';

const qaWallet = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((wallet) => {
    window.localStorage.setItem('palengkepay_address', wallet);
    window.localStorage.setItem('palengkepay_wallet_name', 'QA Wallet');
  }, qaWallet);
});

test('/vendor/transactions exposes income proof exports and caveats', async ({ page }) => {
  await page.goto('/vendor/transactions');

  await expect(page.getByRole('heading', { name: 'Income Proof Pack' })).toBeVisible();
  await expect(page.getByText(/Exportable vendor proof with source labels and Testnet caveats/i)).toBeVisible();
  await expect(page.getByText(/Live wallet-signed payment smoke is not attached/i)).toBeVisible();
  await expect(page.getByText('PHP est.')).toBeVisible();
  await expect(page.getByText('Date range')).toBeVisible();
  await expect(page.getByRole('button', { name: /CSV/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /JSON/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Print/i })).toBeVisible();
});

test('/vendor/utang exposes collections reporting summary', async ({ page }) => {
  await page.goto('/vendor/utang');

  await expect(page.getByRole('heading', { name: 'Collections Report' })).toBeVisible();
  await expect(page.getByText(/Summary of active, completed|Buod ng aktibo/i)).toBeVisible();
  await expect(page.getByText('Outstanding')).toBeVisible();
  await expect(page.getByText('Collected')).toBeVisible();
});
