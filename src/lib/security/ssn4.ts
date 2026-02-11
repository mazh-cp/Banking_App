/**
 * SSN last 4 (simulation). Spec alias for ssn-last4.
 * Never store plaintext; hash only. Never log SSN4.
 */

import { hashLast4, verifyLast4, validateLast4 } from './ssn-last4';

const SSN4_REGEX = /^\d{4}$/;

export function isValidSSN4(ssn4: string): boolean {
  return SSN4_REGEX.test(ssn4.trim());
}

/** Hash SSN4 with strong KDF (bcrypt) for storage. */
export async function hashSSN4(ssn4: string): Promise<string> {
  if (!validateLast4(ssn4.trim())) throw new Error('SSN4 must be exactly 4 digits');
  return hashLast4(ssn4);
}

/** Verify user-provided SSN4 against stored hash. */
export async function verifySSN4(ssn4: string, hash: string): Promise<boolean> {
  return verifyLast4(ssn4, hash);
}
