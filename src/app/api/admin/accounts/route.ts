/**
 * GET /api/admin/accounts – list all users with accounts and balances. Admin-only.
 * Writes audit log.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { prisma } from '@/lib/db';

export async function GET() {
  let session: { user: { id: string } };
  try {
    session = await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.auditEvent.create({
    data: {
      eventType: 'ADMIN_VIEW_ACCOUNTS',
      userId: session.user.id,
      actorUserId: session.user.id,
      route: '/api/admin/accounts',
      metadata: {},
    },
  });

  const users = await prisma.user.findMany({
    where: { role: { in: ['customer', 'readonly'] } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      accounts: {
        where: { status: 'active' },
        select: { id: true, type: true, accountNumber: true, balance: true, status: true },
        orderBy: { type: 'asc' },
      },
    },
    orderBy: { email: 'asc' },
  });

  const list = users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    accounts: u.accounts.map((a) => ({
      id: a.id,
      type: a.type,
      accountNumber: a.accountNumber,
      balance: Number(a.balance),
      status: a.status,
    })),
  }));

  return NextResponse.json({ users: list });
}
