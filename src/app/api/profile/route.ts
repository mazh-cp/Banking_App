import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const bodySchema = z.object({
  preferredName: z.string().max(100).nullable(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const raw = await request.json();
    const { preferredName } = bodySchema.parse(raw);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredName },
    });
    return NextResponse.json({ ok: true, preferredName });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
