import { expect, test } from '@playwright/test';

const protectedRoutes = [
  '/customer/home',
  '/customer/history',
  '/customer/utang',
  '/customer/scan',
  '/vendor/home',
  '/vendor/qr',
  '/vendor/transactions',
  '/vendor/utang',
  '/vendor/profile',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('palengkepay_address');
    window.localStorage.removeItem('palengkepay_wallet_name');
  });
});

for (const route of protectedRoutes) {
  test(`${route} shows a clear disconnected wallet state`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'Connect wallet to continue' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Connect Wallet$/ }).last()).toBeVisible();
  });
}
