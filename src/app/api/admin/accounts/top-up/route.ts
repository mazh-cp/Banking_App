/**
 * POST /api/admin/accounts/top-up – credit an account (admin top-up). Admin-only.
 * Body: { userId: string, accountId?: string, accountType?: 'checking' | 'savings', amount: number }
 * Either accountId or accountType required. Writes audit and transaction.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { prisma } from '@/lib/db';
import { adminTopUpAccount } from '@/lib/banking/banking-service';
import { z } from 'zod';

const bodySchema = z.object({
  userId: z.string().min(1),
  accountId: z.string().optional(),
  accountType: z.enum(['checking', 'savings']).optional(),
  amount: z.number().positive(),
}).refine((d) => d.accountId ?? d.accountType, { message: 'Provide accountId or accountType' });

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await requireAdmin();
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors.map((x) => x.message).join('; ') }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const accountIdOrType = body.accountId ?? body.accountType!;
  const result = await adminTopUpAccount(
    body.userId,
    accountIdOrType,
    body.amount,
    session.user.id
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Top-up failed' }, { status: 400 });
  }

  await prisma.auditEvent.create({
    data: {
      eventType: 'ADMIN_TOP_UP',
      userId: session.user.id,
      actorUserId: session.user.id,
      route: '/api/admin/accounts/top-up',
      metadata: {
        targetUserId: body.userId,
        accountId: result.accountId,
        amount: body.amount,
        transactionId: result.transactionId,
      },
    },
  });

  return NextResponse.json({
    success: true,
    accountId: result.accountId,
    newBalance: result.newBalance,
    transactionId: result.transactionId,
  });
}
