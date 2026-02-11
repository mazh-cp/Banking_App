import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { prisma } from '@/lib/db';

const RANGES = ['24h', '7d', '30d'] as const;
type Range = (typeof RANGES)[number];

function rangeToDate(range: Range): Date {
  const now = Date.now();
  const ms = range === '24h' ? 24 * 60 * 60 * 1000 : range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms);
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get('range') ?? '24h') as Range;
  const since = RANGES.includes(range) ? rangeToDate(range) : rangeToDate('24h');

  const [
    logins,
    chatSessions,
    chatAudits,
    fileUploads,
    eventsByType,
  ] = await Promise.all([
    prisma.auditEvent.count({ where: { eventType: 'LOGIN', createdAt: { gte: since } } }),
    prisma.chatAudit.groupBy({ by: ['userId'], where: { createdAt: { gte: since } }, _count: { id: true } }),
    prisma.chatAudit.count({ where: { createdAt: { gte: since } } }),
    prisma.fileUpload.count({ where: { createdAt: { gte: since } } }),
    prisma.auditEvent.groupBy({ by: ['eventType'], where: { createdAt: { gte: since } }, _count: { id: true } }),
  ]);

  const toolCallsResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::int as count FROM "ChatAudit" WHERE "created_at" >= ${since} AND tools_used IS NOT NULL
  `;
  const toolCalls = Number(toolCallsResult[0]?.count ?? 0);

  const chatByUser = chatSessions
    .map((s) => ({ userId: s.userId, count: s._count.id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const userIds = Array.from(new Set(chatByUser.map((s) => s.userId).filter((id): id is string => id != null)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return NextResponse.json({
    range,
    since: since.toISOString(),
    summary: {
      logins,
      chatRequests: chatAudits,
      chatSessionsWithActivity: chatSessions.length,
      toolCalls: toolCalls,
      fileUploads,
    },
    eventsByType: Object.fromEntries(eventsByType.map((e) => [e.eventType, e._count.id])),
    topUsersByChat: chatByUser.map((s) => {
      const uid = s.userId ?? '';
      const u = uid ? userMap[uid] : null;
      return {
        userId: s.userId,
        email: u?.email ?? s.userId ?? null,
        name: u ? `${u.firstName} ${u.lastName}` : null,
        chatCount: s.count,
      };
    }),
  });
}
