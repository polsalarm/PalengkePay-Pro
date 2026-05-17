import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { chromium } from 'playwright';

const routes = [
  '/',
  '/connect',
  '/onboard',
  '/dashboard',
  '/test-send',
  '/receipt/demo-hash',
  '/customer/home',
  '/customer/scan',
  '/customer/history',
  '/customer/utang',
  '/vendor/home',
  '/vendor/apply',
  '/vendor/qr',
  '/vendor/transactions',
  '/vendor/utang',
  '/vendor/profile',
  '/admin/market',
  '/admin/register',
  '/admin/metrics',
  '/admin/health',
  '/admin/proofs',
  '/market',
  '/api/health',
];

function isoStamp(date = new Date()) {
  return date.toISOString();
}

function fileStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function routeToSlug(route) {
  if (route === '/') return 'root';
  return route.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '-') || 'route';
}

async function waitForUrl(url, retries = 60, delayMs = 1000) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Keep polling until the preview server or deployment responds.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Base URL did not become ready: ${url}`);
}

async function captureApiHealth(baseUrl, evidenceDir, screenshotsDir, page) {
  const url = new URL('/api/health', baseUrl).toString();
  const timestamp = fileStamp();
  const screenshotName = `api-health_fullpage_${timestamp}.png`;
  const screenshotPath = path.join(screenshotsDir, screenshotName);
  const jsonName = `api_health_${timestamp}.json`;
  const jsonPath = path.join(screenshotsDir, jsonName);
  const response = await fetch(url);
  const body = await response.text();
  const parsed = JSON.parse(body);

  await fs.writeFile(jsonPath, `${JSON.stringify(parsed, null, 2)}\n`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const log = {
    timestamp_utc: isoStamp(),
    environment: baseUrl.includes('vercel.app') ? 'vercel-deployment' : 'local-preview',
    endpoint: '/api/health',
    base_url: baseUrl,
    route: '/api/health',
    response_status: response.status,
    screenshot_path: `route-matrix-screenshots/${screenshotName}`,
    json_artifact: `route-matrix-screenshots/${jsonName}`,
    response: body,
    parsed,
  };
  await fs.writeFile(path.join(evidenceDir, 'api-health-screenshot-log.json'), `${JSON.stringify(log, null, 2)}\n`);

  return {
    route: '/api/health',
    url,
    timestamp_utc: isoStamp(),
    playwright_status: response.status,
    loaded: response.ok,
    http_status: response.status,
    http_ok: response.ok,
    screenshot_path: `route-matrix-screenshots/${screenshotName}`,
    body_preview: body.slice(0, 250),
    http_body: body,
    health_parsed: parsed,
  };
}

async function main() {
  const baseUrl = process.env.ROUTE_BASE_URL ?? 'http://127.0.0.1:4173';
  const startLocalServer = baseUrl === 'http://127.0.0.1:4173';
  const runStamp = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date()
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, '')}`;
  const evidenceDir = path.join(process.cwd(), 'docs', 'verification-evidence', runStamp);
  const screenshotsDir = path.join(evidenceDir, 'route-matrix-screenshots');
  let server;

  await fs.mkdir(screenshotsDir, { recursive: true });

  if (startLocalServer) {
    server = spawn(process.execPath, ['scripts/serve-dist.mjs', '--host', '127.0.0.1', '--port', '4173'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
  }

  try {
    await waitForUrl(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const startedAt = isoStamp();
    const routeRows = [];

    for (const route of routes) {
      if (route === '/api/health') {
        routeRows.push(await captureApiHealth(baseUrl, evidenceDir, screenshotsDir, page));
        continue;
      }

      const routeUrl = new URL(route, baseUrl).toString();
      const screenshotName = `${routeToSlug(route)}_fullpage_${fileStamp()}.png`;
      const screenshotPath = path.join(screenshotsDir, screenshotName);
      let status = 0;
      let ok = false;
      let loaded = false;
      let preview = '';

      try {
        const response = await page.goto(routeUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        status = response?.status() ?? 0;
        ok = response?.ok() ?? false;
        loaded = true;
        preview = ((await page.textContent('body')) ?? '').slice(0, 200);
      } catch (error) {
        preview = error instanceof Error ? error.message : String(error);
      }

      await page.screenshot({ path: screenshotPath, fullPage: true });
      routeRows.push({
        route,
        url: routeUrl,
        timestamp_utc: isoStamp(),
        playwright_status: status,
        loaded,
        http_status: status,
        http_ok: ok,
        screenshot_path: `route-matrix-screenshots/${screenshotName}`,
        body_preview: preview,
      });
    }

    await browser.close();

    const matrixLog = {
      generated_at_utc: isoStamp(),
      base_url: baseUrl,
      started_at_utc: startedAt,
      routes: routeRows,
    };

    await fs.writeFile(path.join(evidenceDir, 'route-matrix-log.json'), `${JSON.stringify(matrixLog, null, 2)}\n`);
    await fs.writeFile(
      path.join(evidenceDir, 'route-matrix-log.md'),
      [
        '# Route matrix',
        `Generated: ${matrixLog.generated_at_utc}`,
        `Base URL: ${baseUrl}`,
        '',
        '| route | status | screenshot |',
        '| --- | --- | --- |',
        ...routeRows.map((row) => `| ${row.route} | ${row.http_status || 'ERR'} | ${row.screenshot_path} |`),
        '',
      ].join('\n'),
    );

    console.log(`Generated evidence in ${path.relative(process.cwd(), evidenceDir)}`);
  } finally {
    if (server) server.kill('SIGINT');
  }
}

await main();
