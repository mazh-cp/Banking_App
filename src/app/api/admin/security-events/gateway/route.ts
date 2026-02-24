import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { readLastSecurityEvents } from '@/lib/security/security-events';

const DEFAULT_LIMIT = 100;

/**
 * GET /api/admin/security-events/gateway
 * Returns last N Lakera Guard gateway events from data/security-events.jsonl.
 * Distinct from GET /api/admin/security-events which reads SQLite chat_events.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  try {
    const events = await readLastSecurityEvents(limit);
    return NextResponse.json({ events, source: 'gateway' });
  } catch (e) {
    console.error('security-events/gateway error', e);
    return NextResponse.json({ events: [], source: 'gateway', error: 'Failed to read gateway events' }, { status: 200 });
  }
}
