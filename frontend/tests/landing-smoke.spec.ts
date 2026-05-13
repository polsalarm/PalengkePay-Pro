import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const smokeRoutes = [
  { path: '/', text: /Digital payments/i },
  { path: '/connect', text: /Connect/i },
  { path: '/onboard', text: /wallet/i },
  { path: '/customer/home', text: /wallet|connect|customer|home/i },
  { path: '/vendor/home', text: /wallet|connect|vendor|home/i },
  { path: '/admin/market', text: /wallet|connect|admin|market/i },
  { path: '/market', text: /market|vendor|connect/i },
];

async function withRuntimeErrorCapture(page: Page, run: () => Promise<void>) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onPageError = (error: Error) => pageErrors.push(error.message);

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    await run();
    expect(pageErrors, 'page runtime errors').toEqual([]);
    expect(consoleErrors, 'browser console errors').toEqual([]);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

for (const { path, text } of smokeRoutes) {
  test(`renders ${path}`, async ({ page }) => {
    await withRuntimeErrorCapture(page, async () => {
      await page.goto(path);
      await expect(page.locator('#root')).not.toBeEmpty();
      await expect(page.locator('body')).toContainText(text, { timeout: 15_000 });
    });
  });
}

test('captures landing screenshot', async ({ page }, testInfo) => {
  await withRuntimeErrorCapture(page, async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Digital payments/i })).toBeVisible();

    await fs.mkdir('qa-artifacts', { recursive: true });
    await page.screenshot({
      path: `qa-artifacts/${testInfo.project.name}-landing.png`,
      fullPage: true,
    });
  });
});
