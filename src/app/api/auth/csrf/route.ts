import { NextResponse } from 'next/server';
import { createCsrfToken, getCsrfCookieName, getSessionMaxAge } from '@/lib/auth';

export async function GET() {
  const token = createCsrfToken();
  const res = NextResponse.json({ token });
  res.cookies.set(getCsrfCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: getSessionMaxAge(),
    path: '/',
  });
  return res;
}
