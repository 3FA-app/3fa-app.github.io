// Home-page specific content.
//
// The generic checks that used to live here — successful response, non-empty
// branded <title>, and absence of console errors — now run against EVERY page
// from pages.spec.mjs via the PAGES table, so they are not duplicated here.
// What remains is the content unique to the home page.

import { test, expect } from '@playwright/test';

const HERO_HEADING = 'The authenticator your desktop was missing.';

test('h1 shows the hero heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(HERO_HEADING);
});

test('the hero has a lede and a call to action', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero .lede')).toBeVisible();
  await expect(page.locator('.hero .cta a').first()).toBeVisible();
});

test('shows at least 6 feature cards, each with a heading and body', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.card');
  expect(await cards.count()).toBeGreaterThanOrEqual(6);
  await expect(cards.first()).toBeVisible();
  await expect(cards.nth(5)).toBeVisible();

  const empty = await page.$$eval('.card', (els) =>
    els
      .filter((el) => {
        const heading = el.querySelector('h3')?.textContent?.trim() ?? '';
        const body = el.querySelector('p')?.textContent?.trim() ?? '';
        return heading.length === 0 || body.length === 0;
      })
      .map((el) => el.textContent?.trim().slice(0, 40) ?? '(empty)'),
  );
  expect(empty, 'feature cards must have both a heading and body text').toEqual([]);
});

test('explains how the lock works in ordered steps', async ({ page }) => {
  await page.goto('/');
  const steps = page.locator('ol.steps li');
  expect(await steps.count()).toBeGreaterThanOrEqual(3);
  await expect(steps.first()).toBeVisible();
});

test('nav links to the security and download pages', async ({ page }) => {
  await page.goto('/');
  // Resolved hrefs rather than hard-coded "/security", so this still holds for
  // a project-style Pages deploy served under a non-root BASE_PATH.
  const hrefs = await page.$$eval('header nav a', (els) => els.map((el) => el.href));
  expect(hrefs.some((href) => /\/security\/?$/.test(href))).toBe(true);
  expect(hrefs.some((href) => /\/download\/?$/.test(href))).toBe(true);
});
