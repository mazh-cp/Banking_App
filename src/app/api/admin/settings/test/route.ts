import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getSecret, getConfig } from '@/lib/admin/secrets-store';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const bodySchema = z.object({ target: z.enum(['openai', 'anthropic', 'lakera', 'lakeraProject']) });

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
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let success = false;
  let message = '';

  try {
    if (body.target === 'openai') {
      const key = await getSecret('OPENAI_API_KEY');
      if (!key) {
        message = 'OpenAI API key not set';
      } else {
        const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
        success = res.ok;
        message = res.ok ? 'Connection OK' : `HTTP ${res.status}`;
      }
    } else if (body.target === 'anthropic') {
      const key = await getSecret('ANTHROPIC_API_KEY');
      if (!key) {
        message = 'Anthropic API key not set';
      } else {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }),
        });
        success = res.ok || res.status === 400;
        message = res.ok ? 'Connection OK' : res.status === 400 ? 'Connection OK (validation only)' : `HTTP ${res.status}`;
      }
    } else if (body.target === 'lakera') {
      const key = await getSecret('LAKERA_API_KEY');
      if (!key) {
        message = 'Lakera API key not set';
      } else {
        const res = await fetch('https://api.lakera.ai/v1/guard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ input: 'What is the weather?' }),
        });
        success = res.ok;
        message = res.ok ? 'Guard responded OK' : `HTTP ${res.status}`;
      }
    } else {
      const projectId = await getConfig('LAKERA_PROJECT_ID');
      success = !!projectId && projectId.length > 0;
      message = success ? 'Project ID is set and format accepted' : 'Project ID not set';
    }
  } catch (err) {
    message = err instanceof Error ? err.message : 'Request failed';
  }

  await prisma.auditEvent.create({
    data: { eventType: 'ADMIN_SETTINGS_TESTED', userId: session.user.id, metadata: { target: body.target, success } },
  });

  return NextResponse.json({ success, message: message.replace(/sk-[^\s]+/g, '[REDACTED]') });
}
