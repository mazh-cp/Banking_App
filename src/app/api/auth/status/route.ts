/**
 * GET /api/auth/status – diagnostic only. Returns whether session and CSRF cookies are present.
 * Use in browser or DevTools to verify auth cookies are set (e.g. after login).
 */
import { NextResponse } from 'next/server';
import { getSessionCookieName, getCsrfCookieName } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;
  const csrfToken = cookieStore.get(getCsrfCookieName())?.value;
  return NextResponse.json({
    hasSessionCookie: !!sessionToken,
    hasCsrfCookie: !!csrfToken,
    sessionCookieName: getSessionCookieName(),
    csrfCookieName: getCsrfCookieName(),
  });
}
