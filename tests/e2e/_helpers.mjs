// Shared fixtures for the browser-automation suite.
//
// The specs are deliberately data-driven: every page of the site is described
// once, here, so adding a page to src/pages/ and adding a row to PAGES is all
// it takes to get the whole structural/accessibility/console battery applied to
// it. Copy-pasted per-page blocks rot; a table does not.

/** The releases origin the site is built against. Kept in sync with the default
 *  in astro.config.mjs / src/lib/releases.ts. Download URLs must live here. */
export const RELEASES_ORIGIN =
  process.env.PUBLIC_RELEASES_URL ?? 'https://downloads.threefa.app';

/** Every routable page the site publishes.
 *
 *  `heading` is matched loosely against the page's <h1>. These are the only
 *  copy assertions in the suite and they are intentionally shallow — the point
 *  is "the right page rendered", not "the marketing wording is exactly this".
 *  Brittle prose assertions are a maintenance tax, so we assert on structure
 *  and behaviour everywhere else. */
export const PAGES = [
  { name: 'home', path: '/', heading: /authenticator/i },
  { name: 'security', path: '/security', heading: /security/i },
  { name: 'download', path: '/download', heading: /download/i },
];

/** A path that must never exist, used to exercise the 404 route. */
export const NOT_FOUND_PATH = '/this-route-should-never-exist-3fa';

/**
 * Attach listeners that record everything a browser considers broken:
 * console errors, uncaught exceptions, and requests that failed at the network
 * layer. Call BEFORE navigating; read `.problems()` after.
 *
 * Only a real browser can observe these — they are invisible to a static HTML
 * check, which is precisely why they belong in the browser-automation suite.
 */
export function watchForProblems(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // The favicon is served, but a preview server can still 404 it in some
    // configurations; it is not a site defect worth failing a build over.
    if (/favicon/i.test(text)) return;
    consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    // Aborted requests are usually the harness navigating away, not a defect.
    if (failure && /ERR_ABORTED/.test(failure.errorText)) return;
    failedRequests.push(`${request.url()} — ${failure?.errorText ?? 'unknown'}`);
  });

  return {
    consoleErrors,
    pageErrors,
    failedRequests,
    /** Flat, human-readable list for a single assertion with a useful diff. */
    problems() {
      return [
        ...consoleErrors.map((e) => `console error: ${e}`),
        ...pageErrors.map((e) => `uncaught error: ${e}`),
        ...failedRequests.map((e) => `failed request: ${e}`),
      ];
    },
  };
}

/** Every anchor on the current page, as { href, resolved, target, rel, download }. */
export async function anchors(page) {
  const raw = await page.$$eval('a[href]', (els) =>
    els.map((el) => ({
      href: el.getAttribute('href'),
      resolved: el.href,
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
      download: el.hasAttribute('download'),
      text: (el.textContent ?? '').trim().slice(0, 80),
    })),
  );
  return raw;
}

/** True when `resolved` is on the same origin as the page under test. */
export function isSameOrigin(resolved, pageUrl) {
  try {
    return new URL(resolved).origin === new URL(pageUrl).origin;
  } catch {
    return false;
  }
}

/** Heading levels in DOM order, e.g. [1, 2, 3, 3, 2]. */
export function headingLevels(page) {
  return page.$$eval('h1, h2, h3, h4, h5, h6', (els) =>
    els.map((el) => Number(el.tagName.slice(1))),
  );
}
