import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getVerificationStatus } from '@/lib/chat/verification';
import { prisma } from '@/lib/db';

/**
 * GET /api/chat/verification-status
 * Returns whether the current user must verify with SSN last 4 before using chat.
 * Used by the chat page to show the verification step as the first step on load.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ssnLast4Hash: true },
    });

    if (!user?.ssnLast4Hash) {
      return NextResponse.json({
        verificationRequired: false,
        verificationNotConfigured: true,
      });
    }

    const status = await getVerificationStatus(userId);
    if (status.verified) {
      return NextResponse.json({
        verificationRequired: false,
        verifiedExpiresAt: status.expiresAt.toISOString(),
      });
    }

    return NextResponse.json({
      verificationRequired: true,
      reason: status.reason,
      lockedUntil: status.lockedUntil?.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
