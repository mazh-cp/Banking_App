import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { verifyCsrfToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt, hasEncryptionKey } from '@/lib/security/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const ALLOWED_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'LAKERA_API_KEY'] as const;
const bodySchema = z.object({ keyName: z.enum(ALLOWED_KEYS), value: z.string().min(1), csrfToken: z.string().optional() });

export async function POST(request: Request) {
  let adminUserId: string;
  try {
    const session = await requireAdmin();
    adminUserId = session.user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forbidden';
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { allowed } = checkRateLimit('admin-settings');
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  if (!hasEncryptionKey()) {
    return NextResponse.json({ error: 'SECRETS_ENCRYPTION_KEY not configured' }, { status: 503 });
  }

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

  const { ciphertext, iv, tag, keyVersion } = encrypt(body.value);
  await prisma.appSecret.upsert({
    where: { keyName: body.keyName },
    create: {
      keyName: body.keyName,
      ciphertext,
      iv,
      tag,
      keyVersion,
      updatedByUserId: adminUserId,
    },
    update: {
      ciphertext,
      iv,
      tag,
      keyVersion,
      updatedByUserId: adminUserId,
    },
  });

  await prisma.auditEvent.create({
    data: { eventType: 'ADMIN_SECRET_UPDATED', userId: adminUserId, metadata: { keyName: body.keyName } },
  });

  return NextResponse.json({ ok: true, keyName: body.keyName });
}

const ALLOWED_KEYS_DELETE = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'LAKERA_API_KEY'] as const;

export async function DELETE(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forbidden';
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { allowed } = checkRateLimit('admin-settings');
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const url = new URL(request.url);
  const keyName = url.searchParams.get('keyName');
  if (!keyName || !ALLOWED_KEYS_DELETE.includes(keyName as (typeof ALLOWED_KEYS_DELETE)[number])) {
    return NextResponse.json({ error: 'Invalid keyName' }, { status: 400 });
  }

  await prisma.appSecret.deleteMany({ where: { keyName } });
  await prisma.auditEvent.create({
    data: { eventType: 'ADMIN_SECRET_REMOVED', userId: session.user.id, metadata: { keyName } },
  });

  return NextResponse.json({ ok: true });
}
