import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { readLastSecurityEvents } from '@/lib/security/security-events';
import Link from 'next/link';

const N = 100;

export default async function AdminSecurityEventsPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/dashboard');

  const events = await readLastSecurityEvents(N);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Security gateway events</h1>
      <p className="text-slate-600 mb-4">
        Redacted Lakera Guard events (USER_INPUT, RAG_CONTEXT, TOOL_ARGS, LLM_OUTPUT). Last {N} events. No raw PII or prompts.
      </p>
      <p className="text-sm text-slate-500 mb-2">
        <Link href="/admin/security-warnings" className="text-bank-primary hover:underline">← Security warnings</Link>
      </p>
      <p className="text-xs text-slate-500 mb-6">
        This page reads from <strong>gateway</strong> events (data/security-events.jsonl). For chat block history and Lakera blocks (SQLite <code>chat_events</code>), use <Link href="/admin/security-warnings" className="text-bank-primary hover:underline">Security Warnings</Link>.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2 pr-4 font-medium text-slate-700">Time</th>
              <th className="py-2 pr-4 font-medium text-slate-700">Stage</th>
              <th className="py-2 pr-4 font-medium text-slate-700">Action</th>
              <th className="py-2 pr-4 font-medium text-slate-700">Reasons</th>
              <th className="py-2 pr-4 font-medium text-slate-700">User</th>
              <th className="py-2 pr-4 font-medium text-slate-700">CorrelationId</th>
              <th className="py-2 font-medium text-slate-700">Preview (redacted)</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-slate-500">
                  No events yet. Events are written when chat is screened (USER_INPUT, RAG_CONTEXT, TOOL_ARGS, LLM_OUTPUT).
                </td>
              </tr>
            ) : (
              events.map((ev, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-600">{ev.ts}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{ev.stage}</td>
                  <td className="py-2 pr-4">{ev.action}</td>
                  <td className="py-2 pr-4 text-xs">{(ev.reasonCodes ?? []).join(', ') || '—'}</td>
                  <td className="py-2 pr-4 text-slate-600">{ev.userId}</td>
                  <td className="py-2 pr-4 font-mono text-xs truncate max-w-[120px]" title={ev.correlationId}>{ev.correlationId}</td>
                  <td className="py-2 text-slate-600 max-w-[200px] truncate" title={ev.redactedPreview}>{ev.redactedPreview || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
