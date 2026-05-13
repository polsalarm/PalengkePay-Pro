import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

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

const screenshotStates = [
  { name: 'customer-home-disconnected', route: '/customer/home', heading: 'Connect wallet to continue' },
  { name: 'customer-scan-disconnected', route: '/customer/scan', heading: 'Connect wallet to continue' },
  { name: 'vendor-qr-disconnected', route: '/vendor/qr', heading: 'Connect wallet to continue' },
  { name: 'vendor-profile-disconnected', route: '/vendor/profile', heading: 'Connect wallet to continue' },
];

for (const state of screenshotStates) {
  test(`captures ${state.name} state screenshot`, async ({ page }, testInfo) => {
    await fs.mkdir('qa-artifacts/states', { recursive: true });
    await page.goto(state.route);
    await expect(page.getByRole('heading', { name: state.heading })).toBeVisible();
    await page.screenshot({
      path: `qa-artifacts/states/${testInfo.project.name}-${state.name}.png`,
      fullPage: true,
    });
  });
}

const configuredWalletScreenshots = [
  { name: 'customer-utang-config-state', route: '/customer/utang' },
  { name: 'vendor-apply-config-state', route: '/vendor/apply' },
  { name: 'vendor-qr-config-state', route: '/vendor/qr' },
];

for (const state of configuredWalletScreenshots) {
  test(`captures ${state.name} screenshot`, async ({ page }, testInfo) => {
    await fs.mkdir('qa-artifacts/states', { recursive: true });
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'palengkepay_address',
        'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH',
      );
      window.localStorage.setItem('palengkepay_wallet_name', 'QA Wallet');
    });
    await page.goto(state.route);
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.screenshot({
      path: `qa-artifacts/states/${testInfo.project.name}-${state.name}.png`,
      fullPage: true,
    });
  });
}
