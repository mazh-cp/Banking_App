import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminAccountsClient } from './AdminAccountsClient';

export default async function AdminAccountsPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/dashboard');

  await prisma.auditEvent.create({
    data: {
      eventType: 'ADMIN_VIEW_ACCOUNTS',
      userId: session.user.id,
      actorUserId: session.user.id,
      route: '/admin/accounts',
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Accounts & Balances</h1>
      <p className="text-slate-600 mb-6">
        List all customer accounts and balances. Top-up credits an account and writes an audit log and transaction.
      </p>
      <AdminAccountsClient initialUsers={list} />
      <Link href="/admin/activity" className="mt-4 inline-block text-sm text-bank-primary hover:underline">
        ← Back to Activity
      </Link>
    </div>
  );
}
