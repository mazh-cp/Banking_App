import { getSession } from '@/lib/auth';
import { getBalances, getRecentTransactions, getAccounts, computeSnapshotHash } from '@/lib/banking/banking-service';
import { prisma } from '@/lib/db';
import Link from 'next/link';

const sevenDaysAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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

  const now = new Date();
  const since7d = sevenDaysAgo();

  const [balances, recentTxList, accounts, adminData] = await Promise.all([
    getBalances(userId),
    getRecentTransactions(userId, 5),
    getAccounts(userId),
    isAdmin
      ? (async () => {
          const [
            activeUsers,
            loginsPast7Days,
            usersFlaggedSecurity,
            chatTotal7d,
            blocked7d,
            safeRewrite7d,
            chatAudits7d,
            recentBlocked,
            recentSafeRewrite,
            recentHighRisk,
            blockedByUser,
            safeRewriteByUser,
            highRiskByUser,
          ] = await Promise.all([
            prisma.session.findMany({ where: { expiresAt: { gt: now } }, select: { userId: true } }).then((s) => new Set(s.map((x) => x.userId)).size),
            prisma.auditEvent.groupBy({ by: ['userId'], where: { eventType: 'LOGIN', createdAt: { gte: since7d } } }).then((g) => g.length),
            prisma.chatAudit.groupBy({ by: ['userId'], where: { blocked: true, createdAt: { gte: since7d } } }).then((g) => g.filter((x) => x.userId != null).length),
            prisma.chatAudit.count({ where: { createdAt: { gte: since7d } } }),
            prisma.chatAudit.count({ where: { blocked: true, createdAt: { gte: since7d } } }),
            prisma.chatAudit.count({ where: { safeRewrite: true, createdAt: { gte: since7d } } }),
            prisma.chatAudit.findMany({
              where: { createdAt: { gte: since7d } },
              select: { riskLevel: true, categories: true, userId: true },
            }),
            prisma.chatAudit.findMany({
              where: { blocked: true },
              orderBy: { createdAt: 'desc' },
              take: 6,
              include: { user: { select: { email: true, firstName: true, lastName: true } } },
            }),
            prisma.chatAudit.findMany({
              where: { safeRewrite: true },
              orderBy: { createdAt: 'desc' },
              take: 6,
              include: { user: { select: { email: true, firstName: true, lastName: true } } },
            }),
            prisma.chatAudit.findMany({
              where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
              orderBy: { createdAt: 'desc' },
              take: 6,
              include: { user: { select: { email: true, firstName: true, lastName: true } } },
            }),
            prisma.chatAudit.groupBy({ by: ['userId'], where: { blocked: true, createdAt: { gte: since7d } }, _count: { id: true } }),
            prisma.chatAudit.groupBy({ by: ['userId'], where: { safeRewrite: true, createdAt: { gte: since7d } }, _count: { id: true } }),
            prisma.chatAudit.groupBy({ by: ['userId'], where: { riskLevel: { in: ['HIGH', 'CRITICAL'] }, createdAt: { gte: since7d } }, _count: { id: true } }),
          ]);

          const byRisk = chatAudits7d.reduce(
            (acc, e) => {
              const level = (e.riskLevel as string) ?? 'LOW';
              acc[level] = (acc[level] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );
          const categoryCounts: Record<string, number> = {};
          for (const e of chatAudits7d) {
            const cats = (e.categories as string[] | null) ?? [];
            for (const c of cats) {
              if (c && c !== 'lakera_unavailable' && c !== 'lakera_off') categoryCounts[c] = (categoryCounts[c] || 0) + 1;
            }
          }
          const topCategories = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

          const userIdsBlocked = [...blockedByUser].sort((a, b) => b._count.id - a._count.id).slice(0, 5).map((x) => x.userId).filter(Boolean) as string[];
          const userIdsRewrite = [...safeRewriteByUser].sort((a, b) => b._count.id - a._count.id).slice(0, 5).map((x) => x.userId).filter(Boolean) as string[];
          const userIdsHighRisk = [...highRiskByUser].sort((a, b) => b._count.id - a._count.id).slice(0, 5).map((x) => x.userId).filter(Boolean) as string[];
          const allUserIds = Array.from(new Set([...userIdsBlocked, ...userIdsRewrite, ...userIdsHighRisk]));
          const users = allUserIds.length ? await prisma.user.findMany({ where: { id: { in: allUserIds } }, select: { id: true, email: true, firstName: true, lastName: true } }) : [];
          const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

          const topBlockedUsers = userIdsBlocked.map((id) => ({ user: userMap[id], count: blockedByUser.find((g) => g.userId === id)?._count.id ?? 0 }));
          const topRewriteUsers = userIdsRewrite.map((id) => ({ user: userMap[id], count: safeRewriteByUser.find((g) => g.userId === id)?._count.id ?? 0 }));
          const topHighRiskUsers = userIdsHighRisk.map((id) => ({ user: userMap[id], count: highRiskByUser.find((g) => g.userId === id)?._count.id ?? 0 }));

          return {
            activeUsers,
            loginsPast7Days,
            usersFlaggedSecurity,
            chatTotal7d,
            blocked7d,
            safeRewrite7d,
            byRisk,
            topCategories,
            recentBlocked,
            recentSafeRewrite,
            recentHighRisk,
            topBlockedUsers,
            topRewriteUsers,
            topHighRiskUsers,
          };
        })()
      : Promise.resolve(null),
  ]);

  const snapshotHash = computeSnapshotHash(balances);
  const recentTx = recentTxList.map((t) => ({
    id: t.date,
    type: t.type,
    amount: t.amount,
    description: t.description,
    createdAt: new Date(t.date),
  }));

  return (
    <div>
      {isAdmin && adminData && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Admin overview</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/admin/activity" className="rounded-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm hover:border-teal-400 hover:shadow-md transition-all">
                <p className="text-sm font-medium text-teal-700">Active users</p>
                <p className="text-3xl font-bold text-teal-700 mt-1">{adminData.activeUsers}</p>
                <p className="text-xs text-slate-500 mt-1">Users with active session</p>
              </Link>
              <Link href="/admin/activity?range=7d" className="rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm hover:border-sky-400 hover:shadow-md transition-all">
                <p className="text-sm font-medium text-sky-700">Logins (7d)</p>
                <p className="text-3xl font-bold text-sky-700 mt-1">{adminData.loginsPast7Days}</p>
                <p className="text-xs text-slate-500 mt-1">Distinct users logged in</p>
              </Link>
              <Link href="/admin/security-warnings" className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition-all">
                <p className="text-sm font-medium text-amber-800">Users flagged</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{adminData.usersFlaggedSecurity}</p>
                <p className="text-xs text-slate-500 mt-1">Chat blocked by Guard</p>
              </Link>
              <Link href="/admin/risk-map" className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                <p className="text-sm font-medium text-slate-700">Chat requests (7d)</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{adminData.chatTotal7d}</p>
                <p className="text-xs text-slate-500 mt-1">Total screened</p>
              </Link>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Findings & flags (last 7 days)</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm">
                <p className="text-sm font-medium text-red-700">Blocked</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{adminData.blocked7d}</p>
                <p className="text-xs text-slate-500 mt-1">Requests blocked</p>
              </div>
              <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
                <p className="text-sm font-medium text-amber-800">Safe rewrite</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{adminData.safeRewrite7d}</p>
                <p className="text-xs text-slate-500 mt-1">Response rewritten</p>
              </div>
              <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
                <p className="text-sm font-medium text-emerald-700">LOW risk</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{adminData.byRisk.LOW ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">Chat audits</p>
              </div>
              <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm">
                <p className="text-sm font-medium text-orange-700">MEDIUM / HIGH</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">{(adminData.byRisk.MEDIUM ?? 0) + (adminData.byRisk.HIGH ?? 0)}</p>
                <p className="text-xs text-slate-500 mt-1">Elevated risk</p>
              </div>
              <div className="rounded-xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
                <p className="text-sm font-medium text-rose-700">CRITICAL</p>
                <p className="text-3xl font-bold text-rose-600 mt-1">{adminData.byRisk.CRITICAL ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">Critical risk</p>
              </div>
            </div>
            {adminData.topCategories.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-600 mb-2">Top flag categories</p>
                <div className="flex flex-wrap gap-2">
                  {adminData.topCategories.map(([cat, count]) => (
                    <span
                      key={cat}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      {cat.replace(/_/g, ' ')} <span className="ml-1 font-bold text-slate-900">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Top users by activity & flags</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="card border-l-4 border-l-red-400">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Most blocked</p>
                  <ul className="space-y-1.5 text-sm">
                    {adminData.topBlockedUsers.slice(0, 5).map(({ user, count }) =>
                      user ? (
                        <li key={user.id} className="flex justify-between">
                          <span className="text-slate-700 truncate max-w-[140px]" title={user.email}>{user.firstName} {user.lastName}</span>
                          <span className="font-semibold text-red-600">{count}</span>
                        </li>
                      ) : null
                    )}
                    {adminData.topBlockedUsers.length === 0 && <li className="text-slate-500">None</li>}
                  </ul>
                </div>
                <div className="card border-l-4 border-l-amber-400">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Most safe-rewritten</p>
                  <ul className="space-y-1.5 text-sm">
                    {adminData.topRewriteUsers.slice(0, 5).map(({ user, count }) =>
                      user ? (
                        <li key={user.id} className="flex justify-between">
                          <span className="text-slate-700 truncate max-w-[140px]" title={user.email}>{user.firstName} {user.lastName}</span>
                          <span className="font-semibold text-amber-600">{count}</span>
                        </li>
                      ) : null
                    )}
                    {adminData.topRewriteUsers.length === 0 && <li className="text-slate-500">None</li>}
                  </ul>
                </div>
                <div className="card border-l-4 border-l-orange-400">
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">High / critical risk</p>
                  <ul className="space-y-1.5 text-sm">
                    {adminData.topHighRiskUsers.slice(0, 5).map(({ user, count }) =>
                      user ? (
                        <li key={user.id} className="flex justify-between">
                          <span className="text-slate-700 truncate max-w-[140px]" title={user.email}>{user.firstName} {user.lastName}</span>
                          <span className="font-semibold text-orange-600">{count}</span>
                        </li>
                      ) : null
                    )}
                    {adminData.topHighRiskUsers.length === 0 && <li className="text-slate-500">None</li>}
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick links</h2>
              <div className="flex flex-col gap-2">
                <Link href="/admin/activity" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300">Activity</Link>
                <Link href="/admin/risk-map" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300">Risk map</Link>
                <Link href="/admin/security-warnings" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300">Security warnings</Link>
                <Link href="/admin/audit" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300">Audit log</Link>
                <Link href="/admin/compliance" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300">Compliance</Link>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent malicious & flagged activity</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-xl border border-red-200 bg-red-50/50 overflow-hidden">
                <div className="bg-red-100 px-4 py-2 border-b border-red-200">
                  <p className="text-sm font-semibold text-red-800">Recent blocks</p>
                </div>
                <ul className="divide-y divide-red-100 max-h-64 overflow-y-auto">
                  {adminData.recentBlocked.slice(0, 5).map((e) => (
                    <li key={e.id} className="px-4 py-2 text-sm">
                      <p className="text-slate-600 line-clamp-2">{e.contentPreview || '—'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {e.user ? `${e.user.firstName} ${e.user.lastName}` : 'Unknown'} · {new Date(e.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                  {adminData.recentBlocked.length === 0 && <li className="px-4 py-4 text-slate-500 text-sm">No blocks yet</li>}
                </ul>
                <Link href="/admin/security-warnings" className="block px-4 py-2 text-sm font-medium text-red-700 bg-red-100/80 hover:bg-red-200/80">View all →</Link>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                <div className="bg-amber-100 px-4 py-2 border-b border-amber-200">
                  <p className="text-sm font-semibold text-amber-800">Recent safe rewrites</p>
                </div>
                <ul className="divide-y divide-amber-100 max-h-64 overflow-y-auto">
                  {adminData.recentSafeRewrite.slice(0, 5).map((e) => (
                    <li key={e.id} className="px-4 py-2 text-sm">
                      <p className="text-slate-600 line-clamp-2">{e.contentPreview || '—'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {e.user ? `${e.user.firstName} ${e.user.lastName}` : 'Unknown'} · {new Date(e.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                  {adminData.recentSafeRewrite.length === 0 && <li className="px-4 py-4 text-slate-500 text-sm">None yet</li>}
                </ul>
                <Link href="/admin/audit" className="block px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100/80 hover:bg-amber-200/80">View audit →</Link>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 overflow-hidden">
                <div className="bg-orange-100 px-4 py-2 border-b border-orange-200">
                  <p className="text-sm font-semibold text-orange-800">High / critical risk</p>
                </div>
                <ul className="divide-y divide-orange-100 max-h-64 overflow-y-auto">
                  {adminData.recentHighRisk.slice(0, 5).map((e) => (
                    <li key={e.id} className="px-4 py-2 text-sm">
                      <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-orange-200 text-orange-800">{e.riskLevel}</span>
                      <p className="text-slate-600 line-clamp-2 mt-1">{e.contentPreview || '—'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {e.user ? `${e.user.firstName} ${e.user.lastName}` : 'Unknown'} · {new Date(e.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                  {adminData.recentHighRisk.length === 0 && <li className="px-4 py-4 text-slate-500 text-sm">None</li>}
                </ul>
                <Link href="/admin/risk-map" className="block px-4 py-2 text-sm font-medium text-orange-800 bg-orange-100/80 hover:bg-orange-200/80">Risk map →</Link>
              </div>
            </div>
          </section>
        </>
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
