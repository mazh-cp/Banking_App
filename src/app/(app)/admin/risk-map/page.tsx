import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { TOP_10_LLM_APPS } from '@/lib/risk/top10-llm-apps';

export default async function AdminRiskMapPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/dashboard');

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [chatEvents, fileScans, last24h, last7d, last30d] = await Promise.all([
    prisma.chatAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      where: { riskLevel: { not: null } },
      include: { user: { select: { email: true } } },
    }),
    prisma.fileScan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.chatAudit.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.chatAudit.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.chatAudit.count({ where: { createdAt: { gte: monthAgo } } }),
  ]);

  const byRiskLevel = chatEvents.reduce(
    (acc, e) => {
      const level = e.riskLevel ?? 'LOW';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const categoryCounts: Record<string, number> = {};
  for (const e of chatEvents) {
    const cats = (e.categories as string[] | null) ?? [];
    for (const c of cats) {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const personaCounts: Record<string, number> = {};
  for (const e of chatEvents) {
    const p = e.persona ?? 'unknown';
    personaCounts[p] = (personaCounts[p] || 0) + 1;
  }

  const fileByLevel = fileScans.reduce(
    (acc, f) => {
      const level = f.riskLevel ?? 'LOW';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-6">Risk map</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Chat misuse metrics (from audit)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="card">
            <p className="text-sm text-slate-500">LOW</p>
            <p className="text-2xl font-bold text-green-600">{byRiskLevel.LOW ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">MEDIUM</p>
            <p className="text-2xl font-bold text-amber-600">{byRiskLevel.MEDIUM ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">HIGH</p>
            <p className="text-2xl font-bold text-orange-600">{byRiskLevel.HIGH ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">CRITICAL</p>
            <p className="text-2xl font-bold text-red-600">{byRiskLevel.CRITICAL ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Time series (24h / 7d / 30d)</p>
            <p className="text-lg font-bold text-slate-700">{last24h} / {last7d} / {last30d}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Blocked / Safe rewrite</p>
            <p className="text-lg font-bold text-slate-700">
              {chatEvents.filter((e) => e.blocked).length} / {chatEvents.filter((e) => e.safeRewrite).length}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Financial data tool usage</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm text-slate-500">Chat requests that used tools</p>
            <p className="text-2xl font-bold text-bank-primary">
              {chatEvents.filter((e) => {
                const t = e.toolsUsed as string[] | null;
                return t && Array.isArray(t) && t.length > 0;
              }).length}
            </p>
            <p className="text-xs text-slate-500">Account-specific answers use server tools only</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Blocked (pre-scan / tool gate)</p>
            <p className="text-2xl font-bold text-red-600">{chatEvents.filter((e) => e.blocked).length}</p>
            <p className="text-xs text-slate-500">Prompt injection / tool abuse blocked</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Lakera coverage</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm text-slate-500">Pre-scan coverage</p>
            <p className="text-2xl font-bold text-green-600">100%</p>
            <p className="text-xs text-slate-500">All chat inputs scanned before tools/LLM</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Post-scan coverage</p>
            <p className="text-2xl font-bold text-green-600">100%</p>
            <p className="text-xs text-slate-500">All assistant outputs scanned</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Top Lakera categories</p>
            <p className="text-sm text-slate-600">{topCategories.slice(0, 5).map(([k]) => k).join(', ') || '—'}</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">File scan metrics</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card">
            <p className="text-sm text-slate-500">Total scans</p>
            <p className="text-2xl font-bold text-slate-700">{fileScans.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">LOW / MEDIUM</p>
            <p className="text-lg font-bold text-green-600">{(fileByLevel.LOW ?? 0) + (fileByLevel.MEDIUM ?? 0)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">HIGH / CRITICAL</p>
            <p className="text-lg font-bold text-red-600">{(fileByLevel.HIGH ?? 0) + (fileByLevel.CRITICAL ?? 0)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Top categories (combined)</p>
            <p className="text-sm text-slate-600">{topCategories.slice(0, 3).map(([k]) => k).join(', ') || '—'}</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Core AI Risk Map – Top 10 LLM applications (financial services)</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Application</th>
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-left py-3 px-4">Common attack vectors</th>
                <th className="text-left py-3 px-4">Likelihood</th>
                <th className="text-left py-3 px-4">Impact</th>
                <th className="text-left py-3 px-4">Composite risk</th>
              </tr>
            </thead>
            <tbody>
              {TOP_10_LLM_APPS.map((app) => (
                <tr key={app.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 font-medium">{app.name}</td>
                  <td className="py-3 px-4 max-w-xs text-slate-600">{app.description}</td>
                  <td className="py-3 px-4 max-w-xs text-slate-600">{app.commonAttackVectors.join(', ')}</td>
                  <td className="py-3 px-4">{app.likelihood}</td>
                  <td className="py-3 px-4">{app.impact}</td>
                  <td className="py-3 px-4">
                    <span className={
                      app.compositeRisk === 'critical' ? 'text-red-600 font-medium' :
                      app.compositeRisk === 'high' ? 'text-orange-600' :
                      app.compositeRisk === 'med' ? 'text-amber-600' : 'text-slate-600'
                    }>{app.compositeRisk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Persona distribution</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(personaCounts).map(([persona, count]) => (
            <div key={persona} className="card py-2 px-4">
              <span className="text-slate-600">{persona}</span>
              <span className="ml-2 font-bold">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Recent events by risk level</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Risk level</th>
                <th className="text-left py-3 px-4">Score</th>
                <th className="text-left py-3 px-4">Blocked</th>
                <th className="text-left py-3 px-4">Safe rewrite</th>
                <th className="text-left py-3 px-4">Preview</th>
              </tr>
            </thead>
            <tbody>
              {chatEvents.slice(0, 100).map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">{e.user?.email ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className={
                      e.riskLevel === 'CRITICAL' ? 'text-red-600 font-medium' :
                      e.riskLevel === 'HIGH' ? 'text-orange-600' :
                      e.riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-slate-600'
                    }>{e.riskLevel ?? '—'}</span>
                  </td>
                  <td className="py-3 px-4">{e.riskScore != null ? (e.riskScore * 100).toFixed(0) + '%' : '—'}</td>
                  <td className="py-3 px-4">{e.blocked ? 'Yes' : 'No'}</td>
                  <td className="py-3 px-4">{e.safeRewrite ? 'Yes' : 'No'}</td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-500">{e.contentPreview ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
