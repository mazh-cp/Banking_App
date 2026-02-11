import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

const RANGES = [{ value: '24h', label: 'Last 24 hours' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }] as const;

function rangeToDate(range: string): Date {
  const now = Date.now();
  const ms = range === '24h' ? 24 * 60 * 60 * 1000 : range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms);
}

export default async function AdminSecurityWarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/dashboard');

  await prisma.auditEvent.create({
    data: {
      eventType: 'ADMIN_VIEW_ACTIVITY',
      userId: session.user.id,
      actorUserId: session.user.id,
      route: '/admin/security-warnings',
      metadata: {},
    },
  });

  const { range = '24h' } = await searchParams;
  const since = RANGES.some((r) => r.value === range) ? rangeToDate(range) : rangeToDate('24h');

  const [
    chatBlocked,
    verificationFailed,
    identityRequired,
    quarantinedFiles,
    blockedAudits,
    blockedLakeraEvents,
  ] = await Promise.all([
    prisma.auditEvent.count({ where: { eventType: 'CHAT_BLOCKED_LAKERA', createdAt: { gte: since } } }),
    prisma.auditEvent.count({ where: { eventType: 'CHAT_IDENTITY_FAILED', createdAt: { gte: since } } }),
    prisma.auditEvent.count({ where: { eventType: 'CHAT_IDENTITY_REQUIRED', createdAt: { gte: since } } }),
    prisma.fileUpload.count({ where: { createdAt: { gte: since }, quarantined: true } }),
    prisma.chatAudit.findMany({
      where: { createdAt: { gte: since }, blocked: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
    prisma.auditEvent.findMany({
      where: { eventType: 'CHAT_BLOCKED_LAKERA', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { lakeraEvidences: true },
    }),
  ]);

  const categoryCounts: Record<string, number> = {};
  for (const a of blockedAudits) {
    const cats = (a.categories as string[] | null) ?? [];
    for (const c of cats) {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Security warnings</h1>
      <p className="text-slate-600 mb-6">Lakera blocks, verification failures, and quarantined files.</p>

      <div className="flex gap-2 mb-6">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/admin/security-warnings?range=${r.value}`}
            className={`rounded-lg px-3 py-1.5 text-sm border ${range === r.value ? 'bg-bank-muted border-bank-primary text-bank-dark' : 'border-slate-300 hover:bg-slate-50'}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="card">
            <p className="text-sm text-slate-500">Chat blocked (Lakera)</p>
            <p className="text-2xl font-bold text-red-600">{chatBlocked}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Verification failed</p>
            <p className="text-2xl font-bold text-amber-600">{verificationFailed}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Identity required (SSN4)</p>
            <p className="text-2xl font-bold text-slate-700">{identityRequired}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Quarantined files</p>
            <p className="text-2xl font-bold text-orange-600">{quarantinedFiles}</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Blocked by category</h2>
        <div className="card flex flex-wrap gap-2">
          {Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <span key={cat} className="rounded bg-red-50 text-red-800 px-2 py-1 text-sm">
                {cat}: {count}
              </span>
            ))}
          {Object.keys(categoryCounts).length === 0 && <p className="text-slate-500 text-sm">None in range</p>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Recent blocked prompts (ChatAudit)</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Risk level</th>
                <th className="text-left py-3 px-4">Preview</th>
              </tr>
            </thead>
            <tbody>
              {blockedAudits.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">{a.user?.email ?? a.userId ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className={a.riskLevel === 'CRITICAL' ? 'text-red-600 font-medium' : a.riskLevel === 'HIGH' ? 'text-orange-600' : 'text-amber-600'}>
                      {a.riskLevel ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-500">{a.contentPreview ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Lakera blocked events (with evidence)</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Risk</th>
                <th className="text-left py-3 px-4">Categories</th>
                <th className="text-left py-3 px-4">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {blockedLakeraEvents.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">{e.userId ? `${String(e.userId).slice(0, 8)}…` : '—'}</td>
                  <td className="py-3 px-4">{e.lakeraSeverity ?? e.riskLevel ?? '—'}</td>
                  <td className="py-3 px-4 max-w-xs truncate">
                    {Array.isArray(e.lakeraCategories) ? (e.lakeraCategories as string[]).join(', ') : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {e.lakeraEvidences.length > 0 ? (
                      <Link href={`/admin/security-warnings/evidence/${e.id}`} className="text-bank-primary hover:underline">
                        View evidence
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
