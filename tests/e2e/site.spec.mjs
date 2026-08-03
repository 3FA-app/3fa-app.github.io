import { test, expect } from '@playwright/test';

const PRODUCT_NAME = '3FA';
const HERO_HEADING = 'The authenticator your desktop was missing.';

test('page loads with a successful response', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
});

test(`title mentions "${PRODUCT_NAME}"`, async ({ page }) => {
  await page.goto('/');
  const title = await page.title();
  expect(title.trim().length).toBeGreaterThan(0);
  expect(title).toContain(PRODUCT_NAME);
});

test('h1 shows the hero heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(HERO_HEADING);
});

test('shows at least 6 feature cards', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.card');
  expect(await cards.count()).toBeGreaterThanOrEqual(6);
  await expect(cards.first()).toBeVisible();
  await expect(cards.nth(5)).toBeVisible();
});

test('nav links to the security and download pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav a[href="/security"]')).toHaveCount(1);
  await expect(page.locator('nav a[href="/download"]')).toHaveCount(1);
});

test('no console errors during load', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.goto('/', { waitUntil: 'load' });
  expect(errors).toEqual([]);
});

test('404 response keeps Astro 7 styling inside the hashed CSP', async ({ page }) => {
  const response = await page.goto('/missing-astro-7-contract');
  expect(response).not.toBeNull();
  expect(response.status()).toBe(404);

  await expect(page.locator('h1')).toHaveText('404');
  await expect(page.locator('[style]')).toHaveCount(0);

  const policy = await page
    .locator('meta[http-equiv="content-security-policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).not.toContain("'unsafe-inline'");
});
