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
    window.localStorage.clear();
  });
});

for (const route of protectedRoutes) {
  test(`${route} shows a clear disconnected wallet state`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Connect wallet to continue' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Connect Wallet$/ }).last()).toBeVisible();
  });
}

test('app shell exposes skip link and Escape-close wallet menu controls', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'palengkepay_address',
      'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH',
    );
    window.localStorage.setItem('palengkepay_wallet_name', 'QA Wallet');
  });

  await page.goto('/vendor/home');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await skipLink.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const walletMenuButton = page.getByRole('banner').getByRole('button', { name: /Wallet menu for/i });
  await expect(walletMenuButton).toHaveAttribute('aria-expanded', 'false');
  await walletMenuButton.click();
  const walletMenu = page.getByRole('menu', { name: 'Wallet actions' });
  await expect(walletMenu).toBeVisible();
  await expect(walletMenuButton).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(walletMenu).toBeHidden();
  await expect(walletMenuButton).toHaveAttribute('aria-expanded', 'false');
});

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
      animations: 'disabled',
      fullPage: false,
    });
  });
}

const configuredWalletScreenshots = [
  { name: 'customer-utang-config-state', route: '/customer/utang', text: /utang|credit/i },
  { name: 'vendor-apply-config-state', route: '/vendor/apply', text: /apply as vendor/i },
  { name: 'vendor-qr-config-state', route: '/vendor/qr', text: /qr|payment/i },
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
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('body')).toContainText(state.text, { timeout: 15_000 });
    await page.screenshot({
      path: `qa-artifacts/states/${testInfo.project.name}-${state.name}.png`,
      animations: 'disabled',
      fullPage: false,
    });
  });
}
