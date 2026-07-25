import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import puppeteer from 'puppeteer';

const PRODUCT_NAME = '3FA';
const HERO_HEADING = 'The authenticator your desktop was missing.';

const externalBaseUrl = process.env.E2E_BASE_URL;
const PREVIEW_PORT = 4322;
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${PREVIEW_PORT}`;

let child;
let browser;
let page;
let response;

function waitForPort(port, host, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const socket = net.connect(port, host);
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`preview server on port ${port} did not become ready`));
        } else {
          setTimeout(attempt, 250);
        }
      });
    };
    attempt();
  });
}

before(async () => {
  if (!externalBaseUrl) {
    child = spawn(
      'npm',
      ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)],
      { stdio: 'ignore' },
    );
    await waitForPort(PREVIEW_PORT, '127.0.0.1');
  }
  browser = await puppeteer.launch({
    // GitHub ubuntu-24 runners restrict unprivileged user namespaces (AppArmor),
    // which breaks Chrome's sandbox; disable it in CI only.
    args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
  });
  page = await browser.newPage();
  response = await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
});

after(async () => {
  if (browser) await browser.close();
  if (child) child.kill();
});

test('page.goto succeeds', () => {
  assert.ok(response, 'expected a navigation response');
  assert.ok(
    response.ok() || response.status() === 304,
    `expected an ok (or 304) response, got ${response.status()}`,
  );
});

test(`title mentions "${PRODUCT_NAME}"`, async () => {
  const title = await page.title();
  assert.ok(title.includes(PRODUCT_NAME), `expected <title> to mention "${PRODUCT_NAME}", got "${title}"`);
});

test('h1 shows the hero heading', async () => {
  const h1Text = await page.$eval('h1', (el) => el.textContent ?? '');
  assert.ok(h1Text.includes(HERO_HEADING), `expected h1 to contain "${HERO_HEADING}", got "${h1Text}"`);
});

test('page links to the download page', async () => {
  const hrefs = await page.$$eval('a', (anchors) => anchors.map((a) => a.getAttribute('href')));
  assert.ok(hrefs.includes('/download'), 'expected a link to /download');
});
