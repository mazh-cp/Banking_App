import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AuditFilters } from './AuditFilters';

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ riskLevel?: string; persona?: string; category?: string; from?: string; to?: string; eventType?: string }>;
}) {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/dashboard');

  const params = await searchParams;
  const where: Record<string, unknown> = {};
  if (params.riskLevel) where.riskLevel = params.riskLevel;
  if (params.persona) where.persona = params.persona;
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) (where.createdAt as Record<string, Date>).gte = new Date(params.from);
    if (params.to) (where.createdAt as Record<string, Date>).lte = new Date(params.to);
  }

  let events = await prisma.chatAudit.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });

  if (params.category) {
    events = events.filter((e) => {
      const cats = (e.categories as string[] | null) ?? [];
      return cats.includes(params.category!);
    });
  }
  const limited = events.slice(0, 300);

  const adminEvents = params.eventType
    ? await prisma.auditEvent.findMany({
        where: { eventType: params.eventType },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    : await prisma.auditEvent.findMany({
        where: { eventType: { in: ['ADMIN_SECRET_UPDATED', 'ADMIN_SECRET_REMOVED', 'ADMIN_CONFIG_UPDATED', 'ADMIN_SETTINGS_TESTED', 'CHAT_FORBIDDEN_KEYS', 'AI_MAINTENANCE_MODE'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-6">Audit log</h1>
      <Suspense fallback={null}><AuditFilters /></Suspense>
      <div className="card overflow-hidden p-0 mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Request ID</th>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Persona</th>
                <th className="text-left py-3 px-4">Model</th>
                <th className="text-left py-3 px-4">Risk level</th>
                <th className="text-left py-3 px-4">Score</th>
                <th className="text-left py-3 px-4">Categories</th>
                <th className="text-left py-3 px-4">Action</th>
                <th className="text-left py-3 px-4">Preview</th>
              </tr>
            </thead>
            <tbody>
              {limited.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">{e.requestId ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">{e.user ? `${e.user.email}` : '—'}</td>
                  <td className="py-3 px-4">{e.persona ?? '—'}</td>
                  <td className="py-3 px-4">{e.modelUsed ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className={
                      e.riskLevel === 'CRITICAL' ? 'text-red-600' : e.riskLevel === 'HIGH' ? 'text-orange-600' : e.riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-slate-600'
                    }>{e.riskLevel ?? '—'}</span>
                  </td>
                  <td className="py-3 px-4">{e.riskScore != null ? (e.riskScore * 100).toFixed(0) + '%' : '—'}</td>
                  <td className="py-3 px-4 max-w-xs truncate">{(e.categories as string[])?.join(', ') ?? '—'}</td>
                  <td className="py-3 px-4">{e.actionTaken ?? (e.blocked ? 'blocked' : e.safeRewrite ? 'safe_rewrite' : 'allowed')}</td>
                  <td className="py-3 px-4 max-w-xs truncate" title={e.contentPreview ?? ''}>{e.contentPreview ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {limited.length === 0 && <p className="py-8 text-center text-slate-500">No chat audit events.</p>}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Admin / security events</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">Event type</th>
                <th className="text-left py-3 px-4">User ID</th>
                <th className="text-left py-3 px-4">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {adminEvents.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4 font-medium">{e.eventType}</td>
                  <td className="py-3 px-4 text-slate-500">{e.userId ?? '—'}</td>
                  <td className="py-3 px-4 max-w-xs truncate">{JSON.stringify(e.metadata ?? {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {adminEvents.length === 0 && <p className="py-6 text-center text-slate-500">No admin events.</p>}
        </div>
      </section>
    </div>
  );
}
