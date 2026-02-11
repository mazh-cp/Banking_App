/**
 * SSN Last 4 (SIMULATION ONLY). Never store full SSN.
 * Store only hashed last 4 at rest; never display digits.
 * Do not use as auth factor in real systems.
 */

import * as bcrypt from 'bcryptjs';

const LAST4_REGEX = /^\d{4}$/;
const SALT_ROUNDS = 10;

export function validateLast4(last4: string): boolean {
  return LAST4_REGEX.test(last4.trim());
}

/**
 * Hash last 4 digits for storage. Use scrypt-like (bcrypt) — NOT plain sha256.
 */
export async function hashLast4(last4: string): Promise<string> {
  const normalized = last4.trim();
  if (!validateLast4(normalized)) {
    throw new Error('Invalid SSN last 4: must be exactly 4 digits');
  }
  return bcrypt.hash(normalized, SALT_ROUNDS);
}

/**
 * Verify user-provided last 4 against stored hash.
 */
export async function verifyLast4(last4: string, hash: string): Promise<boolean> {
  const normalized = last4.trim();
  if (!validateLast4(normalized) || !hash) return false;
  return bcrypt.compare(normalized, hash);
}
