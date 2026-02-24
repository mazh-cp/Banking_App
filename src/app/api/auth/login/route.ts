import { NextResponse } from 'next/server';
import { login, verifyCsrfToken, getSessionCookieName, getSessionMaxAge } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  csrfToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const body = bodySchema.parse(raw);
    const validCsrf = await verifyCsrfToken(body.csrfToken);
    if (!validCsrf) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
    const result = await login(body.email, body.password);
    if (!result) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    await prisma.auditEvent.create({
      data: { eventType: 'LOGIN', userId: result.user.id, route: '/api/auth/login', metadata: {} },
    });
    const res = NextResponse.json({ user: result.user });
    res.cookies.set(getSessionCookieName(), result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: getSessionMaxAge(),
      path: '/',
    });
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth/login]', e);
    }
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' && e instanceof Error ? e.message : 'Login failed' },
      { status: 500 }
    );
  }
}
