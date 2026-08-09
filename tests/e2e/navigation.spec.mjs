// Link integrity and real navigation.
//
// A static-HTML grep can tell you an href exists. Only a browser can tell you
// that clicking it actually lands on the right page, and that the URL the
// browser resolves it to is reachable.

import { test, expect } from '@playwright/test';
import { PAGES, anchors, isSameOrigin } from './_helpers.mjs';

for (const { name, path } of PAGES) {
  test(`every internal link on ${name} (${path}) resolves`, async ({ page, request }) => {
    await page.goto(path);
    const all = await anchors(page);

    const internal = [...new Set(
      all
        .filter((a) => isSameOrigin(a.resolved, page.url()))
        .map((a) => a.resolved),
    )];

    expect(internal.length, `${path} has no internal links at all`).toBeGreaterThan(0);

    const broken = [];
    for (const url of internal) {
      const response = await request.get(url, { failOnStatusCode: false });
      if (response.status() >= 400) {
        broken.push(`${url} -> ${response.status()}`);
      }
    }
    expect(broken, `broken internal links found on ${path}`).toEqual([]);
  });

  test(`${name} (${path}) links off-site safely`, async ({ page }) => {
    await page.goto(path);
    const all = await anchors(page);

    const unsafe = all
      .filter((a) => a.target === '_blank')
      .filter((a) => !/\bnoopener\b/.test(a.rel ?? ''))
      .map((a) => `${a.href} (rel="${a.rel ?? ''}")`);

    // A target="_blank" link without rel="noopener" hands the opened page a
    // window.opener handle back into this origin. Currently the site has no
    // such links; this guards the day someone adds one.
    expect(unsafe, `target="_blank" links missing rel="noopener" on ${path}`).toEqual([]);

    // No link may ever use a script-executing scheme.
    const dangerous = all
      .filter((a) => /^\s*(javascript|data|vbscript):/i.test(a.href ?? ''))
      .map((a) => a.href);
    expect(dangerous, `dangerous link scheme on ${path}`).toEqual([]);
  });
}

test.describe('header navigation', () => {
  test('the Security nav link navigates to the security page', async ({ page }) => {
    await page.goto('/');
    await page.locator('header nav a', { hasText: /security/i }).click();
    await expect(page).toHaveURL(/\/security\/?$/);
    await expect(page.locator('h1')).toHaveText(/security/i);
  });

  test('the Download nav link navigates to the download page', async ({ page }) => {
    await page.goto('/');
    await page.locator('header nav a', { hasText: /download/i }).click();
    await expect(page).toHaveURL(/\/download\/?$/);
    await expect(page.locator('h1')).toHaveText(/download/i);
  });

  test('the brand link returns to the home page from a subpage', async ({ page }) => {
    await page.goto('/security');
    await page.locator('header .brand').click();
    await expect(page.locator('h1')).toHaveText(/authenticator/i);
  });

  test('the nav is present and identical on every page', async ({ page }) => {
    const seen = [];
    for (const { path } of PAGES) {
      await page.goto(path);
      seen.push(
        await page.$$eval('header nav a', (els) =>
          els.map((el) => `${el.textContent?.trim()}:${el.getAttribute('href')}`).join('|'),
        ),
      );
    }
    // Every page renders the same shared Base layout, so a divergence here
    // means one page has drifted onto its own markup.
    expect(new Set(seen).size, `nav differs between pages: ${JSON.stringify(seen)}`).toBe(1);
  });
});
