import { getSession } from '@/lib/auth';

const ADMIN_ROLE = 'admin';

export async function requireAdmin(): Promise<{ user: { id: string; email: string; firstName: string; lastName: string; role: string } }> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (session.user.role !== ADMIN_ROLE) throw new Error('FORBIDDEN');
  return session;
}

export function isAdminRole(role: string): boolean {
  return role === ADMIN_ROLE;
}
