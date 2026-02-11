import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export default async function AdminLakeraEvidencePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/dashboard');

  const { eventId } = await params;

  const event = await prisma.auditEvent.findFirst({
    where: { id: eventId, eventType: 'CHAT_BLOCKED_LAKERA' },
    include: { lakeraEvidences: true },
  });

  if (!event) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/security-warnings" className="text-bank-primary hover:underline">
          ← Security warnings
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Lakera evidence (admin only)</h1>
      <p className="text-slate-600 mb-6">
        Event: {eventId}. User and prompt details are redacted; detector-level detail is for security review only.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Event summary</h2>
        <div className="card grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Event type</p>
            <p className="font-medium">{event.eventType}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Risk level</p>
            <p className="font-medium">{event.riskLevel ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Lakera severity</p>
            <p className="font-medium">{event.lakeraSeverity ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Request ID</p>
            <p className="font-mono text-sm">{event.lakeraRequestId ?? '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500">Categories</p>
            <p className="font-medium">
              {Array.isArray(event.lakeraCategories)
                ? (event.lakeraCategories as string[]).join(', ')
                : '—'}
            </p>
          </div>
        </div>
      </section>

      {event.lakeraEvidences.length === 0 ? (
        <p className="text-slate-500">No Lakera /guard/results evidence stored for this event.</p>
      ) : (
        event.lakeraEvidences.map((ev) => (
          <section key={ev.id} className="mb-8">
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Evidence (request: {ev.requestId})</h2>
            {ev.summaryJson && (
              <div className="card mb-4">
                <p className="text-xs text-slate-500 mb-1">Summary</p>
                <pre className="text-sm overflow-auto max-h-48 p-2 bg-slate-50 rounded">
                  {JSON.stringify(ev.summaryJson, null, 2)}
                </pre>
              </div>
            )}
            {ev.detectorsJson && (
              <div className="card">
                <p className="text-xs text-slate-500 mb-1">Detectors (redacted)</p>
                <pre className="text-sm overflow-auto max-h-64 p-2 bg-slate-50 rounded">
                  {JSON.stringify(ev.detectorsJson, null, 2)}
                </pre>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
