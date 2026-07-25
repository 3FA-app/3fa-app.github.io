import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCT_NAME = '3FA';
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

test('dist/index.html exists', () => {
  assert.ok(existsSync(indexPath), `expected ${indexPath} to exist — run \`npm run build\` first`);
});

const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';

test('has a <title>', () => {
  assert.match(html, /<title>[^<]+<\/title>/, 'expected a non-empty <title> element');
});

test(`mentions product name "${PRODUCT_NAME}"`, () => {
  assert.ok(html.includes(PRODUCT_NAME), `expected index.html to mention "${PRODUCT_NAME}"`);
});

test('hero heading is present', () => {
  assert.ok(
    html.includes('The authenticator your desktop was missing'),
    'expected the hero heading in index.html',
  );
});

test('no template placeholder leakage in markup', () => {
  // Bundled client <script> code legitimately contains template literals, so
  // check only the markup outside of script bodies.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.ok(!markup.includes('undefined'), 'found "undefined" in index.html markup');
  assert.ok(!/\$\{|\$\d/.test(markup), 'found template placeholder ($ {...} or $N) in index.html markup');
});

test('same-site href/src references resolve to files in dist', () => {
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (ref === '/') continue;
    const clean = ref.split(/[?#]/)[0].replace(/^\/+/, '');
    const candidates = [
      path.join(distDir, clean),
      path.join(distDir, clean, 'index.html'),
      path.join(distDir, `${clean}.html`),
    ];
    assert.ok(
      candidates.some((candidate) => existsSync(candidate)),
      `broken same-site reference: ${ref}`,
    );
  }
});

test('download and security pages are built', () => {
  assert.ok(existsSync(path.join(distDir, 'download', 'index.html')), 'expected dist/download/index.html');
  assert.ok(existsSync(path.join(distDir, 'security', 'index.html')), 'expected dist/security/index.html');
});
