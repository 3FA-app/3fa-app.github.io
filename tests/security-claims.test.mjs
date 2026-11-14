import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const securityPage = readFileSync(new URL('../src/pages/security.astro', import.meta.url), 'utf8');

test('security page distinguishes implemented and planned protections', () => {
  assert.match(securityPage, /At rest \(implemented\)/);
  assert.match(securityPage, /Secure Enclave \/ TPM key wrapping is planned, not implemented/);
  assert.match(securityPage, /Biometrics \(not yet available for unlock\)/);
  assert.match(securityPage, /Current desktop unlock/);
  assert.match(securityPage, /Configurable 2FA\/3FA unlock is not currently available/);
  assert.doesNotMatch(securityPage, /sealed to the platform Secure Enclave \/ TPM/);
  assert.doesNotMatch(securityPage, /configure 2FA or 3FA to taste/);
});

test('vulnerability disclosure remains accessible', () => {
  assert.match(securityPage, /security@threefa\.app/);
  assert.match(securityPage, /\.well-known\/security\.txt/);
});
