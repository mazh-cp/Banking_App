import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hashLast4, validateLast4 } from '@/lib/security/ssn-last4';
import { z } from 'zod';

const bodySchema = z.object({
  last4: z.string().length(4).regex(/^\d{4}$/, 'Must be exactly 4 digits'),
});

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ssnLast4SetAt: true },
    });
    return NextResponse.json({
      set: !!user?.ssnLast4SetAt,
      setAt: user?.ssnLast4SetAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const raw = await request.json();
    const { last4 } = bodySchema.parse(raw);

    if (!validateLast4(last4)) {
      return NextResponse.json({ error: 'Invalid format: must be exactly 4 digits' }, { status: 400 });
    }

    const hash = await hashLast4(last4);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { ssnLast4Hash: hash, ssnLast4SetAt: new Date() },
    });

    await prisma.auditEvent.create({
      data: {
        eventType: 'USER_SSN_LAST4_SET',
        userId: session.user.id,
        route: '/api/profile/ssn-last4',
        metadata: {},
      },
    });

    return NextResponse.json({ ok: true, set: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input: must be exactly 4 digits' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
