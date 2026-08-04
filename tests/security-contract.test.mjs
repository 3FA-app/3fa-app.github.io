import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function headerMap(source) {
  return new Map(
    source
      .split(/\r?\n/u)
      .map((line) => /^\s{2}([^:#][^:]*):\s*(.+)$/u.exec(line))
      .filter(Boolean)
      .map((match) => [match[1].toLowerCase(), match[2].trim()]),
  );
}

function securityTxtMap(source) {
  return new Map(
    source
      .split(/\r?\n/u)
      .map((line) => /^([A-Za-z-]+):\s*(.+)$/u.exec(line))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim()]),
  );
}

test('static-host headers retain the browser isolation baseline', async () => {
  const headers = headerMap(await read('public/_headers'));

  assert.equal(headers.get('content-security-policy'), "frame-ancestors 'none'");
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
  assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(headers.get('x-permitted-cross-domain-policies'), 'none');

  const hsts = headers.get('strict-transport-security');
  assert.match(hsts, /max-age=63072000/u);
  assert.match(hsts, /includeSubDomains/u);
  assert.match(hsts, /preload/u);

  const permissions = headers.get('permissions-policy');
  for (const capability of ['camera', 'geolocation', 'microphone', 'payment', 'usb']) {
    assert.match(permissions, new RegExp(`(?:^|, )${capability}=\\(\\)(?:,|$)`, 'u'));
  }
});

test('security.txt remains actionable, canonical, and unexpired', async () => {
  const fields = securityTxtMap(await read('public/.well-known/security.txt'));

  assert.match(fields.get('Contact'), /^mailto:security@threefa\.app$/u);
  assert.equal(fields.get('Preferred-Languages'), 'en');
  assert.equal(fields.get('Canonical'), 'https://threefa.app/.well-known/security.txt');
  assert.equal(fields.get('Policy'), 'https://threefa.app/security');

  const expiresAt = Date.parse(fields.get('Expires'));
  assert.ok(Number.isFinite(expiresAt), 'Expires must be an RFC 3339 timestamp');
  assert.ok(expiresAt > Date.now(), 'security.txt has expired and must be refreshed');
});

test('Astro CSP configuration stays static and avoids unsafe script/style directives', async () => {
  const config = await read('astro.config.mjs');

  assert.match(config, /output:\s*'static'/u);
  assert.match(config, /syntaxHighlight:\s*'prism'/u);
  assert.match(config, /"default-src 'self'"/u);
  assert.match(config, /"base-uri 'self'"/u);
  assert.match(config, /"form-action 'self'"/u);
  assert.match(config, /"object-src 'none'"/u);
  assert.match(config, /`connect-src 'self' \$\{RELEASES_URL\}`/u);
  assert.doesNotMatch(config, /["'`]script-src[^\n]*unsafe-inline/u);
  assert.doesNotMatch(config, /["'`]style-src[^\n]*unsafe-inline/u);
});
