import { NextResponse } from 'next/server';
import { getSession, logout, getSessionCookieName } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  const session = await getSession();
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (token) await logout(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), '', { maxAge: 0, path: '/' });
  return res;
}
