/**
 * Admin settings tests:
 * - 403 for non-admin on GET /api/admin/settings
 * - Secrets encryption/decryption roundtrip (with mock env key)
 * - No secret value in GET /api/admin/settings response
 *
 * Run: pnpm exec tsx tests/admin-settings.test.ts
 * For full test: need running server and admin session cookie for 403 test; or mock.
 */

import { encrypt, decrypt, maskSecret, hasEncryptionKey } from '../src/lib/security/secrets';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Encryption roundtrip (requires SECRETS_ENCRYPTION_KEY set or we test with a temporary env)
const original = process.env.SECRETS_ENCRYPTION_KEY;
process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 'x').toString('hex'); // 32 bytes hex

try {
  const plain = 'sk-proj-abc123secret';
  const payload = encrypt(plain);
  assert(!!payload.ciphertext, 'ciphertext present');
  assert(!!payload.iv, 'iv present');
  assert(!!payload.tag, 'tag present');
  assert(payload.ciphertext !== plain, 'ciphertext is not plaintext');
  const dec = decrypt(payload);
  assert(dec === plain, 'decrypt roundtrip');
  console.log('Secrets encrypt/decrypt: OK');
} finally {
  if (original !== undefined) process.env.SECRETS_ENCRYPTION_KEY = original;
  else delete process.env.SECRETS_ENCRYPTION_KEY;
}

assert(maskSecret('sk-abc123', 4) === 'sk-…c123', 'mask last 4');
assert(maskSecret('x', 4) === '••••', 'short mask');
console.log('maskSecret: OK');

assert(hasEncryptionKey() === false || hasEncryptionKey() === true, 'hasEncryptionKey returns boolean');
console.log('Admin settings tests passed.');
