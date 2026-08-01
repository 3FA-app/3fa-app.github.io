// Download integrity.
//
// This is the part of a security product's marketing site that actually
// matters: the button that hands a user a binary. These tests assert that the
// site never points that button anywhere except the pinned releases origin —
// including when the embedded release manifest has been tampered with.
//
// They are written to hold in BOTH states of the build: with a populated
// manifest, and with the empty-manifest fallback that src/lib/releases.ts
// produces when the releases origin is unreachable at build time.

import { test, expect } from '@playwright/test';
import { RELEASES_ORIGIN, anchors } from './_helpers.mjs';

const RELEASES_HOST = new URL(RELEASES_ORIGIN).host;

/**
 * Serve the page with a substituted release-data JSON blob, so we can exercise
 * the client-side OS-detect script against a manifest we control. The inline
 * module script itself is left byte-identical, so its CSP hash still matches
 * and it still executes.
 */
async function withReleaseManifest(page, assets) {
  // Matches the block regardless of its other attributes (it carries
  // data-releases-origin, which must be left untouched — tampering with the
  // manifest body must not be able to widen the allow-list).
  const BLOCK = /(<script\b[^>]*\bid="release-data"[^>]*>)([\s\S]*?)(<\/script>)/;
  const state = { substituted: false };

  await page.route('**/*', async (route, request) => {
    if (request.resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    const original = await response.text();
    // Never assert inside a route handler: throwing here aborts the navigation
    // and reports as a confusing ERR_ABORTED instead of the real cause.
    if (BLOCK.test(original)) state.substituted = true;
    const body = original.replace(
      BLOCK,
      (_match, open, _old, close) => open + JSON.stringify(assets) + close,
    );
    await route.fulfill({ response, body });
  });

  return state;
}

/** An asset triple pointing every platform at the same URL, so the test works
 *  whichever OS the browser reports (macOS locally, Linux on CI runners). */
function assetsPointingAt(url) {
  const asset = { url, size: 12_345_678, sha256: 'a'.repeat(64), filename: 'fixture.zip' };
  return { macos: asset, windows: asset, linux: asset };
}

test.describe('primary download button', () => {
  test('is present and starts out pointing at the download page', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#primary-download');
    await expect(btn).toBeVisible();
    const href = await btn.getAttribute('href');
    expect(href).toMatch(/\/download\/?$/);
  });

  test('never resolves to a non-https or off-origin URL as shipped', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(250); // let the OS-detect script settle
    const resolved = await page.locator('#primary-download').evaluate((el) => el.href);

    expect(resolved).not.toMatch(/^javascript:/i);

    const url = new URL(resolved);
    const internal = url.origin === new URL(page.url()).origin;

    // Either it stayed on the internal /download page (which is plain http only
    // because the local preview server is), or the script pointed it at a real
    // asset — and an asset may only ever be https on the releases origin.
    if (!internal) {
      expect(url.protocol, `off-origin download URL must be https: ${resolved}`).toBe('https:');
    }
    expect(
      internal || url.host === RELEASES_HOST,
      `primary download button resolved to ${resolved}, which is neither the ` +
        `internal download page nor an asset on ${RELEASES_HOST}`,
    ).toBe(true);
  });

  // Positive control for the guard test below. If the substituted manifest were
  // ignored (e.g. CSP blocked the script), THIS test fails — which is what
  // stops the hostile-manifest test from passing for the wrong reason.
  test('follows a legitimate manifest to the pinned releases origin', async ({ page }) => {
    const good = `${RELEASES_ORIGIN}/releases/3fa-9.9.9-fixture.zip`;
    const state = await withReleaseManifest(page, assetsPointingAt(good));
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(250);
    expect(state.substituted, 'release-data block not found — the fixture needs updating').toBe(true);

    const btn = page.locator('#primary-download');
    await expect(btn).toHaveAttribute('href', good);
    await expect(btn).toHaveAttribute('download', '');
  });

  for (const [label, hostile] of [
    ['a javascript: URL', 'javascript:alert(document.domain)'],
    ['a plain-http URL', 'http://downloads.threefa.app/releases/evil.zip'],
    ['an https URL on an attacker origin', 'https://evil.example.com/releases/evil.zip'],
    ['a protocol-relative URL', '//evil.example.com/releases/evil.zip'],
  ]) {
    test(`ignores ${label} in a tampered manifest`, async ({ page }) => {
      const state = await withReleaseManifest(page, assetsPointingAt(hostile));
      await page.goto('/', { waitUntil: 'load' });
      await page.waitForTimeout(250);
      expect(state.substituted, 'release-data block not found — the fixture needs updating').toBe(true);

      const resolved = await page.locator('#primary-download').evaluate((el) => el.href);
      expect(resolved, `the button adopted a hostile URL: ${resolved}`).not.toContain('evil.example.com');
      expect(resolved).not.toMatch(/^javascript:/i);
      // It must fall back to the safe internal download page.
      expect(resolved).toMatch(/\/download\/?$/);
    });
  }
});

test.describe('download page', () => {
  test('lists every supported platform', async ({ page }) => {
    await page.goto('/download');
    const rows = page.locator('.row');
    await expect(rows).toHaveCount(3);
    for (const label of ['macOS', 'Windows', 'Linux']) {
      await expect(page.locator('.plat', { hasText: label })).toHaveCount(1);
    }
  });

  test('each platform is either downloadable or explicitly marked pending', async ({ page }) => {
    await page.goto('/download');
    const states = await page.$$eval('.row', (rows) =>
      rows.map((row) => ({
        hasLink: !!row.querySelector('a.dl'),
        pending: !!row.querySelector('.pending'),
      })),
    );
    expect(states).toHaveLength(3);
    for (const state of states) {
      // Never a silent empty row: a user must see either a download or a reason.
      expect(state.hasLink || state.pending).toBe(true);
    }
  });

  test('every advertised download URL is https on the releases origin', async ({ page }) => {
    await page.goto('/download');
    const offending = (await anchors(page))
      .filter((a) => a.download || /\.zip(\?|$)/i.test(a.href ?? ''))
      .filter((a) => {
        try {
          const url = new URL(a.resolved);
          return url.protocol !== 'https:' || url.host !== RELEASES_HOST;
        } catch {
          return true;
        }
      })
      .map((a) => a.href);

    // Vacuously true under the empty-manifest fallback, and the real assertion
    // the moment a release is published.
    expect(offending, `download links must point at https://${RELEASES_HOST}`).toEqual([]);
  });

  test('a published asset shows a full SHA-256 users can verify', async ({ page }) => {
    await page.goto('/download');
    const links = await page.locator('a.dl').count();
    test.skip(links === 0, 'no assets published in this build (empty-manifest fallback)');

    const hashes = await page.$$eval('.hash', (els) =>
      els.map((el) => (el.textContent ?? '').trim()),
    );
    expect(hashes.length).toBe(links);
    for (const hash of hashes) {
      // Truncated digests are worse than none — users cannot verify with them.
      expect(hash).toMatch(/^[0-9a-f]{64}$/i);
    }
  });
});
