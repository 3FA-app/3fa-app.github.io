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
const REQUIRED_PLATFORMS = ['linux', 'macos', 'windows'];

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

function embeddedAssets() {
  const baked = html.match(
    /<script\b(?=[^>]*\btype="application\/json")(?=[^>]*\bid="release-data")[^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(baked !== undefined, 'expected the embedded release-data script in dist/index.html');
  return JSON.parse(baked);
}

function assertCompleteAssets(assets, origin, source) {
  assert.ok(assets && typeof assets === 'object' && !Array.isArray(assets));
  assert.deepEqual(
    Object.keys(assets).sort(),
    REQUIRED_PLATFORMS,
    `${source} must contain exactly the macOS, Windows, and Linux release assets`,
  );

  for (const platform of REQUIRED_PLATFORMS) {
    const asset = assets[platform];
    assert.ok(
      asset && typeof asset === 'object' && !Array.isArray(asset),
      `${platform} asset must be an object`,
    );
    assert.ok(Number.isSafeInteger(asset.size) && asset.size > 0, `${platform} size must be positive`);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/u, `${platform} SHA-256 must be 64 lowercase hex characters`);
    assert.match(
      asset.filename,
      /^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/u,
      `${platform} filename must be a safe zip basename`,
    );

    const url = new URL(asset.url);
    assert.equal(url.protocol, 'https:', `${platform} download must use HTTPS`);
    assert.equal(url.origin, origin, `${platform} download must stay on ${origin}`);
    assert.equal(
      decodeURIComponent(url.pathname.split('/').at(-1)),
      asset.filename,
      `${platform} URL and filename must agree`,
    );
  }
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
      'links. Production workflows pin this canonical origin explicitly; restore its public ' +
      'DNS/TLS endpoint instead of substituting a fallback or weakening this gate.',
  );
});

test('latest.json is valid and complete for every supported platform', async () => {
  const origin = releasesOriginFromBuild();
  let response;
  await assert.doesNotReject(async () => {
    response = await fetch(`${origin}/releases/latest.json`);
  }, `expected ${origin} to resolve and present valid TLS`);
  assert.equal(response.status, 200, `expected ${origin}/releases/latest.json to return HTTP 200`);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/iu);

  const manifest = await response.json();
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u);
  assert.ok(Number.isFinite(Date.parse(manifest.releasedAt)), 'releasedAt must be an ISO timestamp');
  assertCompleteAssets(manifest.assets, origin, 'latest.json');
});

test('the build baked the complete same-origin release asset set', () => {
  const origin = releasesOriginFromBuild();
  assertCompleteAssets(embeddedAssets(), origin, 'built release data');
});
