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
    chatBlocked,
    verificationFailed,
    identityRequired,
    quarantinedFiles,
    blockedAudits,
  ] = await Promise.all([
    prisma.auditEvent.count({ where: { eventType: 'CHAT_BLOCKED_LAKERA', createdAt: { gte: since } } }),
    prisma.auditEvent.count({ where: { eventType: 'CHAT_IDENTITY_FAILED', createdAt: { gte: since } } }),
    prisma.auditEvent.count({ where: { eventType: 'CHAT_IDENTITY_REQUIRED', createdAt: { gte: since } } }),
    prisma.fileUpload.count({ where: { createdAt: { gte: since }, quarantined: true } }),
    prisma.chatAudit.findMany({
      where: { createdAt: { gte: since }, blocked: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, userId: true, riskLevel: true, categories: true, contentPreview: true, createdAt: true },
    }),
  ]);

  const categoryCounts: Record<string, number> = {};
  for (const a of blockedAudits) {
    const cats = (a.categories as string[] | null) ?? [];
    for (const c of cats) {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }
  }

  return NextResponse.json({
    range,
    since: since.toISOString(),
    summary: {
      chatBlocked,
      verificationFailed,
      identityRequired,
      quarantinedFiles,
    },
    byCategory: categoryCounts,
    recentBlocked: blockedAudits,
  });
}
