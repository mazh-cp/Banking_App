import { getSession } from '@/lib/auth';
import { getBalances, getRecentTransactions, getAccounts, computeSnapshotHash } from '@/lib/banking/banking-service';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const params = await searchParams;
  const userId = session.user.id;
  const isAdmin = session.user.role === 'admin';

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [balances, recentTxList, accounts, adminStats] = await Promise.all([
    getBalances(userId),
    getRecentTransactions(userId, 5),
    getAccounts(userId),
    isAdmin
      ? Promise.all([
          prisma.session.findMany({ where: { expiresAt: { gt: now } }, select: { userId: true } }).then((s) => new Set(s.map((x) => x.userId)).size),
          prisma.auditEvent.groupBy({ by: ['userId'], where: { eventType: 'LOGIN', createdAt: { gte: sevenDaysAgo } } }).then((g) => g.length),
          prisma.chatAudit.groupBy({ by: ['userId'], where: { blocked: true } }).then((g) => g.filter((x) => x.userId != null).length),
        ])
      : Promise.resolve([0, 0, 0] as const),
  ]);
  const snapshotHash = computeSnapshotHash(balances);
  const recentTx = recentTxList.map((t) => ({
    id: t.date,
    type: t.type,
    amount: t.amount,
    description: t.description,
    createdAt: new Date(t.date),
  }));
  const [activeUsers, loginsPast7Days, usersFlaggedSecurity] = adminStats;

  return (
    <div>
      {isAdmin && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Admin overview</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href="/admin/activity" className="card hover:border-bank-primary/50 hover:shadow-md transition-shadow">
              <p className="text-sm text-slate-500">Active users</p>
              <p className="text-2xl font-bold text-bank-primary">{activeUsers}</p>
              <p className="text-xs text-slate-400 mt-1">Users with active session</p>
            </Link>
            <Link href="/admin/activity?range=7d" className="card hover:border-bank-primary/50 hover:shadow-md transition-shadow">
              <p className="text-sm text-slate-500">Logins (past 7 days)</p>
              <p className="text-2xl font-bold text-slate-700">{loginsPast7Days}</p>
              <p className="text-xs text-slate-400 mt-1">Distinct users who logged in</p>
            </Link>
            <Link href="/admin/security-warnings" className="card hover:border-bank-primary/50 hover:shadow-md transition-shadow">
              <p className="text-sm text-slate-500">Users flagged for security</p>
              <p className="text-2xl font-bold text-amber-600">{usersFlaggedSecurity}</p>
              <p className="text-xs text-slate-400 mt-1">Chat blocked by Lakera Guard</p>
            </Link>
          </div>
        </section>
      )}

      {params.app && (
        <div className="mb-4 rounded-lg bg-bank-muted border border-bank-primary/30 px-4 py-2 text-bank-dark text-sm">
          Application submitted. We will review it shortly.
        </div>
      )}
      {params.error === 'readonly' && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-amber-800 text-sm">
          Read-only accounts cannot submit applications or upload files.
        </div>
      )}
      {params.error && params.error !== 'readonly' && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-red-700 text-sm">
          Something went wrong. Please try again.
        </div>
      )}
      <h1 className="text-2xl font-bold text-bank-dark mb-6">
        Welcome, {session.user.firstName}
      </h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Accounts</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const amount =
              acc.type === 'checking'
                ? balances.checking
                : acc.type === 'savings'
                  ? balances.savings
                  : balances.creditCardBalance;
            return (
              <div key={acc.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 uppercase">{acc.type}</p>
                    <p className="font-mono text-slate-400 text-sm">•••• {acc.accountNumber.slice(-4)}</p>
                  </div>
                  <span className="text-lg font-bold text-bank-dark">
                    ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{acc.status}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Recent transactions</h2>
          <Link href="/transactions" className="text-bank-primary hover:underline text-sm">View all</Link>
        </div>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-right py-3 px-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-4 text-slate-600">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 capitalize">{t.type}</td>
                  <td className="py-3 px-4">{t.description ?? '—'}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {t.type === 'deposit' || t.type === 'transfer' ? '+' : ''}
                    ${Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentTx.length === 0 && (
            <p className="py-6 text-center text-slate-500">No transactions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
