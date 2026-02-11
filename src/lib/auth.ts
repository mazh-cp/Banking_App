import { cookies } from 'next/headers';
import { prisma } from './db';
import * as bcrypt from 'bcryptjs';

const COOKIE_NAME = process.env.COOKIE_PREFIX || 'finguard';
const SESSION_COOKIE = `${COOKIE_NAME}.session`;
const CSRF_COOKIE = `${COOKIE_NAME}.csrf`;
const SESSION_MAX_AGE = Number(process.env.SESSION_MAX_AGE_SECONDS) || 86400;

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  role: string;
};

function generateToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      preferredName: session.user.preferredName ?? undefined,
      role: session.user.role,
    },
  };
}

export async function requireSession(): Promise<{ user: SessionUser }> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export async function login(email: string, password: string): Promise<{ token: string; user: SessionUser } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await prisma.session.create({
    data: { userId: user.id, token, expiresAt },
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      preferredName: user.preferredName ?? undefined,
      role: user.role,
    },
  };
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getCsrfCookieName(): string {
  return CSRF_COOKIE;
}

export function getSessionMaxAge(): number {
  return SESSION_MAX_AGE;
}

export function createCsrfToken(): string {
  return generateToken();
}

export async function verifyCsrfToken(provided: string): Promise<boolean> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(CSRF_COOKIE)?.value;
  return !!stored && stored.length > 0 && provided === stored;
}
