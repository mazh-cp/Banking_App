/**
 * Chat identity verification (SSN last 4 simulation).
 * Server-only; checked before any sensitive tool calls.
 * Lockout: 3 failures => locked for 15 minutes.
 */

import { prisma } from '@/lib/db';

const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES_BEFORE_LOCK = 3;

export type VerificationStatus =
  | { verified: true; expiresAt: Date }
  | { verified: false; reason: 'expired' | 'not_found' | 'locked'; lockedUntil?: Date };

export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const state = await prisma.chatSessionState.findUnique({
    where: { userId },
  });
  if (!state) return { verified: false, reason: 'not_found' };
  const now = new Date();
  if (state.lockedUntil && state.lockedUntil > now) {
    return { verified: false, reason: 'locked', lockedUntil: state.lockedUntil };
  }
  if (!state.verifiedAt || !state.expiresAt || state.expiresAt < now) {
    return { verified: false, reason: 'expired' };
  }
  return { verified: true, expiresAt: state.expiresAt };
}

export async function setVerified(userId: string): Promise<{ expiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS);
  await prisma.chatSessionState.upsert({
    where: { userId },
    create: {
      userId,
      verifiedAt: now,
      verificationMethod: 'ssn_last4',
      expiresAt,
      verificationFailCount: 0,
    },
    update: {
      verifiedAt: now,
      expiresAt,
      verificationFailCount: 0,
      lockedUntil: null,
    },
  });
  return { expiresAt };
}

/** Record a failed SSN4 attempt. Returns { locked: true, lockedUntil } if lockout applied. */
export async function recordVerificationFailure(userId: string): Promise<{ locked: boolean; lockedUntil?: Date }> {
  const now = new Date();
  const state = await prisma.chatSessionState.findUnique({ where: { userId } });
  const nextCount = (state?.verificationFailCount ?? 0) + 1;
  const lockedUntil = nextCount >= MAX_FAILURES_BEFORE_LOCK ? new Date(now.getTime() + LOCKOUT_MS) : null;
  await prisma.chatSessionState.upsert({
    where: { userId },
    create: {
      userId,
      verificationFailCount: nextCount,
      lockedUntil,
    },
    update: {
      verificationFailCount: nextCount,
      lockedUntil,
      ...(lockedUntil ? { verifiedAt: null, expiresAt: null } : {}),
    },
  });
  return { locked: nextCount >= MAX_FAILURES_BEFORE_LOCK, lockedUntil: lockedUntil ?? undefined };
}

export function isSensitiveRequest(content: string): boolean {
  const lower = content.toLowerCase();
  const patterns = [
    /\b(my|our)\s+(checking|savings|account|balance|balances)\b/,
    /\b(what'?s?|what is)\s+(my|the)\s+(balance|checking|savings|credit)/,
    /\b(how much|balance)\s+(do i have|in my)/,
    /\b(credit\s*(limit|line|utilization)|available\s*credit)\b/,
    /\b(recent\s*)?transactions?\b/,
    /\b(increase\s*my\s*credit|credit\s*increase|raise\s*(my\s*)?limit)\b/,
    /\b(payment\s*history|utilization)\b/,
    /\b(account\s*number|statement|payments?)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

/** User message is exactly 4 digits (verification attempt). */
export function isVerificationAttempt(content: string): boolean {
  return /^\d{4}$/.test(content.trim());
}
