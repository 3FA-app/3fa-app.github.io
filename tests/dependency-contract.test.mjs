import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const parseVersion = (version) => version.split('.').map(Number);

function isAtLeast(version, minimum) {
  const actual = parseVersion(version);
  const expected = parseVersion(minimum);

  for (let index = 0; index < Math.max(actual.length, expected.length); index += 1) {
    const difference = (actual[index] ?? 0) - (expected[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }

  return true;
}

test('the lockfile carries the reviewed Astro 7 security baseline', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lockfile = JSON.parse(await read('package-lock.json'));
  const root = lockfile.packages[''];

  assert.equal(manifest.dependencies.astro, '^7.1.6');
  assert.equal(root.dependencies.astro, manifest.dependencies.astro);
  assert.equal(
    root.dependencies['@astrojs/sitemap'],
    manifest.dependencies['@astrojs/sitemap'],
  );

  const astro = lockfile.packages['node_modules/astro'];
  assert.ok(isAtLeast(astro.version, '7.1.6'), `unexpected Astro version: ${astro.version}`);
  assert.match(astro.engines.node, />=22\.12\.0/u);

  const sharp = lockfile.packages['node_modules/sharp'];
  const svgo = lockfile.packages['node_modules/svgo'];
  assert.ok(isAtLeast(sharp.version, '0.35.0'), `unsafe sharp version: ${sharp.version}`);
  assert.ok(isAtLeast(svgo.version, '4.0.2'), `unsafe svgo version: ${svgo.version}`);
});

test('dependency sources and lifecycle scripts remain reviewable', async () => {
  const lockfile = JSON.parse(await read('package-lock.json'));
  const lifecyclePackages = [];

  for (const [path, metadata] of Object.entries(lockfile.packages)) {
    if (metadata.resolved) {
      assert.match(
        metadata.resolved,
        /^https:\/\/registry\.npmjs\.org\//u,
        `${path} resolves outside the npm registry`,
      );
      assert.ok(metadata.integrity, `${path} is missing an integrity hash`);
    }

    if (metadata.hasInstallScript) lifecyclePackages.push(path);
  }

  assert.deepEqual(lifecyclePackages.sort(), [
    'node_modules/astro/node_modules/esbuild',
    'node_modules/fsevents',
    'node_modules/playwright/node_modules/fsevents',
    'node_modules/puppeteer',
  ]);
});

test('generated pages keep inline styles inside CSP-hashed style blocks', async () => {
  const pages = [];

  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await collect(path);
      else if (entry.name.endsWith('.html')) pages.push(path);
    }
  }

  await collect('dist');
  assert.ok(pages.length >= 4, `expected at least four generated pages, found ${pages.length}`);

  for (const page of pages) {
    const html = await readFile(page, 'utf8');
    assert.doesNotMatch(html, /\sstyle\s*=/iu, `${page} contains a CSP-hostile style attribute`);
    assert.doesNotMatch(html, /(?:style|script)-src[^>]*'unsafe-inline'/iu);
  }
});
