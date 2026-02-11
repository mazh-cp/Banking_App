import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { verifyCsrfToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const bodySchema = z.object({
  configName: z.enum(['LAKERA_PROJECT_ID', 'LAKERA_INPUT_VALIDATION_ENABLED', 'LAKERA_OUTPUT_VALIDATION_ENABLED']),
  value: z.string(),
  csrfToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forbidden';
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await requireAdmin();
  const { allowed } = checkRateLimit('admin-settings');
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
    if (body.csrfToken && !(await verifyCsrfToken(body.csrfToken))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const boolConfigNames = ['LAKERA_INPUT_VALIDATION_ENABLED', 'LAKERA_OUTPUT_VALIDATION_ENABLED'];
  if (boolConfigNames.includes(body.configName) && body.value !== 'true' && body.value !== 'false') {
    return NextResponse.json({ error: 'Value must be "true" or "false" for this config' }, { status: 400 });
  }

  await prisma.appConfig.upsert({
    where: { configName: body.configName },
    create: { configName: body.configName, value: body.value, updatedByUserId: session.user.id },
    update: { value: body.value, updatedByUserId: session.user.id },
  });

  await prisma.auditEvent.create({
    data: { eventType: 'ADMIN_CONFIG_UPDATED', userId: session.user.id, metadata: { configName: body.configName } },
  });

  return NextResponse.json({ ok: true });
}
