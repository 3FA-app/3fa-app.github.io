// Responsive rendering.
//
// Layout overflow is invisible to any static check of the HTML — it only exists
// once a real engine has done layout at a real viewport size, which makes it a
// natural fit for browser automation.

import { test, expect } from '@playwright/test';
import { PAGES } from './_helpers.mjs';

const VIEWPORTS = [
  { name: 'small phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const { name, path } of PAGES) {
      test(`${name} does not scroll horizontally`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'load' });

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const offenders = [];
          const limit = doc.clientWidth;
          for (const el of document.querySelectorAll('body *')) {
            const rect = el.getBoundingClientRect();
            // 1px of tolerance for sub-pixel rounding.
            if (rect.width > 0 && rect.right > limit + 1) {
              offenders.push(
                `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}` +
                  ` (right edge ${Math.round(rect.right)} > ${limit})`,
              );
            }
          }
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: limit,
            offenders: offenders.slice(0, 5),
          };
        });

        expect(
          overflow.scrollWidth,
          `${path} overflows horizontally at ${viewport.width}px. ` +
            `Widest offenders: ${overflow.offenders.join('; ') || 'none identified'}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });

      test(`${name} keeps the nav and heading usable`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'load' });
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('header .brand')).toBeVisible();

        const navLinks = page.locator('header nav a');
        const count = await navLinks.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i += 1) {
          await expect(navLinks.nth(i)).toBeVisible();
        }
      });
    }
  });
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the primary download call to action is visible without scrolling sideways', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const btn = page.locator('#primary-download');
    await expect(btn).toBeVisible();

    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
    // A primary CTA below the comfortable tap-target size is a real usability bug.
    expect(box.height).toBeGreaterThanOrEqual(40);
  });
});
