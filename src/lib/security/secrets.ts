import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const KEY_VERSION = 1;

function getEncryptionKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be set and at least 32 characters (or 32-byte base64/hex)');
  }
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    const buf = Buffer.from(raw, 'hex');
    if (buf.length === KEY_LENGTH) return buf;
  }
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === KEY_LENGTH) return buf;
  } catch {
    // not valid base64
  }
  return scryptSync(raw, 'finguard-secrets-salt', KEY_LENGTH);
}

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
};

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyVersion: KEY_VERSION,
  };
}

export function decrypt(record: { ciphertext: string; iv: string; tag: string }): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(record.iv, 'base64');
  const tag = Buffer.from(record.tag, 'base64');
  const ciphertext = Buffer.from(record.ciphertext, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
}

export function maskSecret(value: string, lastChars = 4): string {
  if (!value || value.length <= lastChars) return '••••';
  return value.slice(0, 3) + '…' + value.slice(-lastChars);
}

export function hasEncryptionKey(): boolean {
  try {
    const raw = process.env.SECRETS_ENCRYPTION_KEY;
    return !!(raw && raw.length >= 32);
  } catch {
    return false;
  }
}
