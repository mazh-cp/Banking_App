import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getDemoDb } from '@/lib/sqlite-db';

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const userId = searchParams.get('user_id') ?? undefined;
  const action = searchParams.get('action') ?? undefined;

  try {
    const db = getDemoDb();
    let sql = 'SELECT id, user_id, request_id, event_type, labels, action, created_at FROM chat_events WHERE 1=1';
    const params: (string | number)[] = [];
    if (fromParam) {
      sql += ' AND datetime(created_at) >= datetime(?)';
      params.push(fromParam);
    }
    if (toParam) {
      sql += ' AND datetime(created_at) <= datetime(?)';
      params.push(toParam);
    }
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    sql += ' ORDER BY created_at DESC LIMIT 500';

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as {
      id: number;
      user_id: string | null;
      request_id: string | null;
      event_type: string;
      labels: string | null;
      action: string;
      created_at: string;
    }[];

    const events = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      requestId: r.request_id,
      eventType: r.event_type,
      labels: r.labels ? (JSON.parse(r.labels) as string[]) : null,
      action: r.action,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ events });
  } catch (e) {
    console.error('security-events error', e);
    return NextResponse.json({ events: [], error: 'Failed to read chat_events' }, { status: 200 });
  }
}
