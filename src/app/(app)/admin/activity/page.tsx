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

export default async function AdminActivityPage({
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
      route: '/admin/activity',
      metadata: {},
    },
  });

  const { range = '24h' } = await searchParams;
  const since = RANGES.some((r) => r.value === range) ? rangeToDate(range) : rangeToDate('24h');

  const [
    logins,
    chatAudits,
    chatByUser,
    fileUploads,
    eventsByType,
  ] = await Promise.all([
    prisma.auditEvent.count({ where: { eventType: 'LOGIN', createdAt: { gte: since } } }),
    prisma.chatAudit.count({ where: { createdAt: { gte: since } } }),
    prisma.chatAudit.groupBy({ by: ['userId'], where: { createdAt: { gte: since } }, _count: { id: true } }),
    prisma.fileUpload.count({ where: { createdAt: { gte: since } } }),
    prisma.auditEvent.groupBy({ by: ['eventType'], where: { createdAt: { gte: since } }, _count: { id: true } }),
  ]);

  const toolCallsResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::int as count FROM "ChatAudit" WHERE "created_at" >= ${since} AND tools_used IS NOT NULL
  `;
  const toolCalls = Number(toolCallsResult[0]?.count ?? 0);

  const sortedByChat = [...chatByUser].sort((a, b) => b._count.id - a._count.id).slice(0, 20);
  const userIds = Array.from(new Set(sortedByChat.map((s) => s.userId).filter((id): id is string => id != null)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, firstName: true, lastName: true } }) : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Global activity</h1>
      <p className="text-slate-600 mb-6">Aggregated user activity across all users.</p>

      <div className="flex gap-2 mb-6">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/admin/activity?range=${r.value}`}
            className={`rounded-lg px-3 py-1.5 text-sm border ${range === r.value ? 'bg-bank-muted border-bank-primary text-bank-dark' : 'border-slate-300 hover:bg-slate-50'}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="card">
            <p className="text-sm text-slate-500">Logins</p>
            <p className="text-2xl font-bold text-bank-primary">{logins}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Chat requests</p>
            <p className="text-2xl font-bold text-slate-700">{chatAudits}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Tool calls</p>
            <p className="text-2xl font-bold text-slate-700">{toolCalls}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">File uploads</p>
            <p className="text-2xl font-bold text-slate-700">{fileUploads}</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Events by type</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Event type</th>
                <th className="text-right py-3 px-4">Count</th>
              </tr>
            </thead>
            <tbody>
              {eventsByType.map((e) => (
                <tr key={e.eventType} className="border-b border-slate-100">
                  <td className="py-3 px-4 font-medium">{e.eventType}</td>
                  <td className="py-3 px-4 text-right">{e._count.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Top users by chat activity</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-right py-3 px-4">Chat count</th>
              </tr>
            </thead>
            <tbody>
              {sortedByChat.map((s) => {
                const uid = s.userId ?? '';
                const u = uid ? userMap[uid] : null;
                return (
                  <tr key={uid} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      {(u?.email ?? uid) || '—'}
                      {u && (
                        <span className="text-slate-500 ml-1">
                          ({u.firstName} {u.lastName})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">{s._count.id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
