import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidReleaseAsset } from '../src/lib/release-validation.ts';

const origin = 'https://downloads.threefa.app';
const good = {
  url: `${origin}/releases/v1/3fa-1.0.0-linux.zip`,
  filename: '3fa-1.0.0-linux.zip',
  size: 1024,
  sha256: 'a'.repeat(64),
};

test('validates complete, same-origin release assets', () => {
  assert.equal(isValidReleaseAsset(good, origin), true);
});

test('rejects deceptive download URLs and filenames', () => {
  for (const url of [
    'http://downloads.threefa.app/release.zip',
    'https://evil.example/release.zip',
    'https://user:pass@downloads.threefa.app/release.zip',
    `${good.url}?token=unsafe`,
    `${good.url}#fragment`,
    `${origin}/releases/v1/not-the-same.zip`,
    `${origin}/releases/v1/%33fa-1.0.0-linux.zip`,
  ]) {
    assert.equal(isValidReleaseAsset({ ...good, url }, origin), false, url);
  }
});

test('rejects unsafe and incomplete metadata', () => {
  for (const changes of [
    { size: 0 }, { size: -1 }, { size: Number.MAX_SAFE_INTEGER + 1 },
    { size: 1.25 }, { sha256: 'abc' }, { sha256: 'A'.repeat(64) },
    { filename: '../3fa.zip' }, { filename: '3fa.tar.gz' },
    { filename: '3fa%2Fother.zip' }, { filename: 'another.zip' },
  ]) {
    assert.equal(isValidReleaseAsset({ ...good, ...changes }, origin), false);
  }
  for (const invalid of [null, '', 123, [], {}]) {
    assert.equal(isValidReleaseAsset(invalid, origin), false);
  }
});
