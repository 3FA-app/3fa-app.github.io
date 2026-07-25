// Regression lock for the release-manifest origin.
//
// `getLatestRelease()` fetches `${PUBLIC_RELEASES_URL}/releases/latest.json` in
// component frontmatter, i.e. at BUILD time, and deliberately swallows every
// error so the site still builds before the first release exists. That fallback
// means an unreachable releases origin produces a perfectly valid build with no
// download links at all, and nothing in the build log says so.
//
// These tests make that condition loud: the origin the build was configured with
// must be a host that actually resolves, and a build that fell back to the empty
// manifest must be recognisable as such.
//
// Run `npm run build` first — like tests/dist.test.mjs, this reads dist/.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { promises as dns } from 'node:dns';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';

/** The configured PUBLIC_RELEASES_URL, read back out of the built page. Astro
 *  interpolates it into the meta CSP's `connect-src`, which is the only place
 *  the origin survives into the output when the manifest fetch failed. */
function releasesOriginFromBuild() {
  const csp = html.match(/http-equiv="content-security-policy"\s+content="([^"]*)"/i)?.[1];
  assert.ok(csp, 'expected a meta Content-Security-Policy in dist/index.html');
  const connectSrc = csp.split(';').find((directive) => directive.trim().startsWith('connect-src'));
  assert.ok(connectSrc, 'expected a connect-src directive in the built CSP');
  const origin = connectSrc.match(/https?:\/\/[^\s;]+/)?.[0];
  assert.ok(
    origin,
    `expected connect-src to name the releases origin, got "${connectSrc.trim()}"`,
  );
  return origin.replace(/\/$/, '');
}

test('dist/index.html exists', () => {
  assert.ok(existsSync(indexPath), `expected ${indexPath} to exist — run \`npm run build\` first`);
});

test('the releases origin the build used resolves in DNS', async () => {
  const origin = releasesOriginFromBuild();
  const { hostname } = new URL(origin);
  await assert.doesNotReject(
    () => dns.lookup(hostname),
    `the build fetched the release manifest from ${origin}, but ${hostname} does not resolve, so ` +
      'getLatestRelease() fell back to an empty manifest and this build ships zero download ' +
      'links. Set PUBLIC_RELEASES_URL to a real origin at build time (it is unset in ' +
      '.github/workflows/deploy.yml, so the astro.config.mjs default is what ships).',
  );
});

test('the build baked a non-empty release manifest', () => {
  const baked = html.match(
    /<script type="application\/json" id="release-data">([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(baked !== undefined, 'expected the embedded release-data script in dist/index.html');

  const assets = JSON.parse(baked);
  assert.ok(
    Object.keys(assets).length > 0,
    'the build embedded an empty asset map, so the OS-detect script has nothing to point the ' +
      'primary download button at and every platform renders as "coming soon". This is the ' +
      'silent failure mode of the catch in src/lib/releases.ts getLatestRelease().',
  );
});

test('every embedded asset URL is an https URL on the releases origin', () => {
  const origin = releasesOriginFromBuild();
  const baked = html.match(
    /<script type="application\/json" id="release-data">([\s\S]*?)<\/script>/,
  )?.[1];
  for (const [platform, asset] of Object.entries(JSON.parse(baked ?? '{}'))) {
    assert.ok(
      typeof asset?.url === 'string' && asset.url.startsWith(`${origin}/`),
      `${platform}'s download URL must be an https URL on ${origin}, got ${asset?.url}`,
    );
  }
});
