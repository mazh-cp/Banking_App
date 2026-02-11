import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { verifySSN4 } from '@/lib/security/ssn4';
import { setVerified, recordVerificationFailure, getVerificationStatus } from '@/lib/chat/verification';
import { getDemoUserSsnLast4HashByEmail } from '@/lib/banking/demo-db-read';
import { z } from 'zod';

const bodySchema = z.object({
  last4: z.string().length(4).regex(/^\d{4}$/, 'Must be exactly 4 digits'),
});

const USE_DEMO_FINANCE_DATA = process.env.USE_DEMO_FINANCE_DATA === 'true';

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const raw = await request.json();
    const { last4 } = bodySchema.parse(raw);

    let hashToVerify: string | null = null;
    if (USE_DEMO_FINANCE_DATA && session.user.email) {
      const demoHash = getDemoUserSsnLast4HashByEmail(session.user.email);
      if (demoHash) hashToVerify = demoHash;
    }
    if (!hashToVerify) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { ssnLast4Hash: true },
      });
      hashToVerify = user?.ssnLast4Hash ?? null;
    }
    if (!hashToVerify) {
      return NextResponse.json(
        { error: 'Set your SSN last 4 in Profile → Identity first, or use demo data with last4 in users.csv.' },
        { status: 400 }
      );
    }

    const status = await getVerificationStatus(session.user.id);
    if (status.verified === false && status.reason === 'locked' && status.lockedUntil) {
      return NextResponse.json(
        { error: 'Verification is temporarily locked. Try again in 15 minutes.', lockedUntil: status.lockedUntil.toISOString() },
        { status: 429 }
      );
    }

    const ok = await verifySSN4(last4, hashToVerify);
    if (ok) {
      const { expiresAt } = await setVerified(session.user.id);
      return NextResponse.json({ verified: true, expiresAt: expiresAt.toISOString() });
    }

    const { locked, lockedUntil } = await recordVerificationFailure(session.user.id);
    if (locked && lockedUntil) {
      return NextResponse.json(
        { error: "Verification failed. Locked for 15 minutes.", lockedUntil: lockedUntil.toISOString() },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Verification failed. Try again." }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input: must be exactly 4 digits' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
