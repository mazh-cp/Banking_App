import { NextResponse } from 'next/server';
import { createCsrfToken, getCsrfCookieName, getSessionMaxAge } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  const token = createCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(getCsrfCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: getSessionMaxAge(),
    path: '/',
  });
  return NextResponse.json({ token });
}
