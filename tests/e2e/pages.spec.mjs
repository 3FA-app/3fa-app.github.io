// Structure, metadata, accessibility and runtime health — applied to EVERY
// page via the PAGES table rather than repeated per page.

import { test, expect } from '@playwright/test';
import { PAGES, NOT_FOUND_PATH, watchForProblems, headingLevels } from './_helpers.mjs';

for (const { name, path, heading } of PAGES) {
  test.describe(`${name} (${path})`, () => {
    test('responds successfully', async ({ page }) => {
      const response = await page.goto(path);
      expect(response, `no response for ${path}`).not.toBeNull();
      expect(response.status(), `${path} returned ${response.status()}`).toBeLessThan(400);
    });

    test('has a non-empty, product-branded <title>', async ({ page }) => {
      await page.goto(path);
      const title = (await page.title()).trim();
      expect(title.length).toBeGreaterThan(0);
      expect(title).toContain('3FA');
    });

    test('has a non-empty meta description and a canonical URL', async ({ page }) => {
      await page.goto(path);
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(description?.trim().length ?? 0).toBeGreaterThan(0);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `${path} is missing a canonical URL`).toBeTruthy();
      // Must be an absolute URL or search engines ignore it.
      expect(() => new URL(canonical)).not.toThrow();
    });

    test('declares a document language', async ({ page }) => {
      await page.goto(path);
      // Screen readers pick pronunciation from this; missing lang is a common
      // and easily-regressed a11y failure.
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang?.trim().length ?? 0).toBeGreaterThan(0);
    });

    test('has exactly one non-empty <h1> naming the page', async ({ page }) => {
      await page.goto(path);
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toBeVisible();
      await expect(h1).toHaveText(heading);
    });

    test('heading levels never skip a level', async ({ page }) => {
      await page.goto(path);
      const levels = await headingLevels(page);
      expect(levels.length, `${path} has no headings at all`).toBeGreaterThan(0);
      expect(levels[0], 'the first heading must be the h1').toBe(1);

      for (let i = 1; i < levels.length; i += 1) {
        // Going deeper by more than one (h2 -> h4) breaks screen-reader
        // outlines. Coming back up any distance is fine.
        expect(
          levels[i] - levels[i - 1],
          `heading order jumps from h${levels[i - 1]} to h${levels[i]} on ${path} ` +
            `(full outline: ${levels.join(', ')})`,
        ).toBeLessThanOrEqual(1);
      }
    });

    test('every image has alt text', async ({ page }) => {
      await page.goto(path);
      const missing = await page.$$eval('img', (els) =>
        els
          .filter((el) => el.getAttribute('alt') === null)
          .map((el) => el.getAttribute('src') ?? '(no src)'),
      );
      // Decorative images are allowed alt="" — only a *missing* alt fails.
      expect(missing, `images without an alt attribute on ${path}`).toEqual([]);
    });

    test('renders the shared header nav and footer', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('header nav a')).not.toHaveCount(0);
      await expect(page.locator('header .brand')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
    });

    test('loads with no console errors, exceptions or failed requests', async ({ page }) => {
      const watcher = watchForProblems(page);
      await page.goto(path, { waitUntil: 'load' });
      // Give any deferred module script a tick to run and blow up if it will.
      await page.waitForTimeout(250);
      expect(watcher.problems()).toEqual([]);
    });

    test('ships a Content-Security-Policy without unsafe-inline scripts', async ({ page }) => {
      await page.goto(path);
      // This is a security product's marketing site; a CSP regression here is
      // exactly the kind of thing that should fail a build loudly.
      const csp = await page
        .locator('meta[http-equiv="content-security-policy" i]')
        .getAttribute('content');
      expect(csp, `${path} has no meta CSP`).toBeTruthy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp, 'script-src must stay hash-based').not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    test('loads no subresources over plain http', async ({ page }) => {
      const insecure = [];
      page.on('request', (request) => {
        if (request.url().startsWith('http://') && !/127\.0\.0\.1|localhost/.test(request.url())) {
          insecure.push(request.url());
        }
      });
      await page.goto(path, { waitUntil: 'load' });
      expect(insecure, 'mixed content would be blocked on the real https site').toEqual([]);
    });
  });
}

test.describe('404 handling', () => {
  test('an unknown route returns a 404 status', async ({ page }) => {
    const response = await page.goto(NOT_FOUND_PATH);
    expect(response).not.toBeNull();
    // A static host that answers 200 for unknown paths turns every typo into a
    // soft-404 that search engines index.
    expect(response.status()).toBe(404);
  });

  test('the 404 page renders a heading and a route back to the site', async ({ page }) => {
    await page.goto(NOT_FOUND_PATH);
    await expect(page.locator('h1')).toHaveCount(1);
    const links = page.locator('main a[href]');
    expect(await links.count()).toBeGreaterThan(0);
  });
});
