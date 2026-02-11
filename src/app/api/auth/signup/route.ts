import { NextResponse } from 'next/server';
import { verifyCsrfToken, getSessionCookieName, getSessionMaxAge } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain an uppercase letter').regex(/[a-z]/, 'Password must contain a lowercase letter').regex(/[0-9]/, 'Password must contain a number'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
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

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        role: 'readonly',
      },
    });

    const { login } = await import('@/lib/auth');
    const result = await login(body.email, body.password);
    if (!result) {
      return NextResponse.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
    }

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
      const msg = e.errors.map((x) => x.message).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Sign up failed' }, { status: 500 });
  }
}
