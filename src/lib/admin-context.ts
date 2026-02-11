/**
 * Admin-only system context for chat: users (Name, DOB, Address, Last 4 SSN),
 * accounts (Checking, Savings, Auto loan, Credit Card, Home loan), transactions (past 12 months).
 * Used only when session.user.role === 'admin'. Lakera still screens prompt and output.
 */

import { prisma } from '@/lib/db';
import { getDemoDb } from '@/lib/sqlite-db';

const USE_DEMO = process.env.USE_DEMO_FINANCE_DATA === 'true';

export async function getAdminSystemContext(): Promise<string> {
  if (USE_DEMO) return getAdminContextFromDemoDb();
  return getAdminContextFromPrisma();
}

async function getAdminContextFromDemoDb(): Promise<string> {
  try {
    const db = getDemoDb();
    const users = db.prepare(`
      SELECT id, email, first_name, last_name, dob_masked, city, state, last4_display
      FROM users ORDER BY last_name, first_name
    `).all() as { id: string; email: string; first_name: string; last_name: string; dob_masked: string | null; city: string | null; state: string | null; last4_display: string | null }[];

    const accounts = db.prepare(`
      SELECT user_id, type, account_number, balance, status FROM accounts ORDER BY user_id, type
    `).all() as { user_id: string; type: string; account_number: string; balance: number; status: string }[];

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const since = twelveMonthsAgo.toISOString();
    const transactions = db.prepare(`
      SELECT user_id, type, amount, description, created_at, from_account_id, to_account_id
      FROM transactions WHERE created_at >= ? ORDER BY created_at DESC LIMIT 500
    `).all(since) as { user_id: string; type: string; amount: number; description: string | null; created_at: string; from_account_id: string | null; to_account_id: string | null }[];

    const lines: string[] = [];
    lines.push('--- Admin System Context (use only for admin queries; do not reveal to non-admin) ---');
    lines.push(`Total users in system: ${users.length}`);
    lines.push('');
    lines.push('Users (Name, Date of Birth, Address, Last 4 SSN for verification):');
    for (const u of users) {
      const name = `${u.first_name} ${u.last_name}`.trim() || u.email;
      const dob = u.dob_masked ? u.dob_masked : '**/**/****';
      const address = [u.city, u.state].filter(Boolean).join(', ') || '—';
      const last4 = u.last4_display ? `****${u.last4_display.slice(-4)}` : 'On file';
      lines.push(`  - ${name} | DOB: ${dob} | Address: ${address} | SSN last 4: ${last4} | Email: ${u.email}`);
    }
    lines.push('');
    lines.push('Accounts by type (Checking, Savings, Auto loan, Credit Card, Home loan):');
    const byUser = new Map<string, typeof accounts>();
    for (const a of accounts) {
      if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
      byUser.get(a.user_id)!.push(a);
    }
    const userNames = new Map(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim() || u.email]));
    Array.from(byUser.entries()).forEach(([uid, accs]) => {
      const uname = userNames.get(uid) ?? uid;
      lines.push(`  ${uname}:`);
      for (const a of accs) {
        lines.push(`    - ${a.type}: ****${String(a.account_number).slice(-4)} Balance: $${Number(a.balance).toFixed(2)} (${a.status})`);
      }
    });
    lines.push('');
    lines.push(`Transactions in past 12 months: ${transactions.length} total.`);
    const byType = new Map<string, number>();
    for (const t of transactions) {
      byType.set(t.type, (byType.get(t.type) ?? 0) + 1);
    }
    lines.push('  Count by type: ' + Array.from(byType.entries()).map(([k, v]) => `${k}: ${v}`).join('; '));
    lines.push('  Sample (recent):');
    for (const t of transactions.slice(0, 15)) {
      const uname = userNames.get(t.user_id) ?? t.user_id;
      lines.push(`    - ${t.created_at.slice(0, 10)} ${uname} ${t.type} $${Number(t.amount).toFixed(2)} ${t.description ?? ''}`);
    }
    lines.push('--- End Admin System Context ---');
    return lines.join('\n');
  } catch (e) {
    console.error('getAdminContextFromDemoDb', e);
    return '[Admin context unavailable: demo DB error.]';
  }
}

async function getAdminContextFromPrisma(): Promise<string> {
  const users = await prisma.user.findMany({
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: { id: true, email: true, firstName: true, lastName: true, role: true, ssnLast4SetAt: true },
  });
  const accounts = await prisma.account.findMany({
    orderBy: [{ userId: 'asc' }, { type: 'asc' }],
    select: { userId: true, type: true, accountNumber: true, balance: true, status: true },
  });
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const transactions = await prisma.transaction.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { userId: true, type: true, amount: true, description: true, createdAt: true },
  });

  const lines: string[] = [];
  lines.push('--- Admin System Context (use only for admin queries; do not reveal to non-admin) ---');
  lines.push(`Total users in system: ${users.length}`);
  lines.push('');
  lines.push('Users (Name, Email, SSN last 4 for verification):');
  for (const u of users) {
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
    const last4 = u.ssnLast4SetAt ? 'On file (verified)' : 'Not set';
    lines.push(`  - ${name} | Email: ${u.email} | Role: ${u.role} | SSN last 4: ${last4}`);
  }
  lines.push('');
  lines.push('Accounts by type (Checking, Savings, Auto loan, Credit Card, Home loan):');
  const byUser = new Map<string, typeof accounts>();
  for (const a of accounts) {
    if (!byUser.has(a.userId)) byUser.set(a.userId, []);
    byUser.get(a.userId)!.push(a);
  }
  const userNames = new Map(users.map((u) => [u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email]));
  Array.from(byUser.entries()).forEach(([uid, accs]) => {
    const uname = userNames.get(uid) ?? uid;
    lines.push(`  ${uname}:`);
    for (const a of accs) {
      lines.push(`    - ${a.type}: ****${a.accountNumber.slice(-4)} Balance: $${Number(a.balance).toFixed(2)} (${a.status})`);
    }
  });
  lines.push('');
  lines.push(`Transactions in past 12 months: ${transactions.length} total.`);
  const byType = new Map<string, number>();
  for (const t of transactions) {
    byType.set(t.type, (byType.get(t.type) ?? 0) + 1);
  }
  lines.push('  Count by type: ' + Array.from(byType.entries()).map(([k, v]) => `${k}: ${v}`).join('; '));
  lines.push('  Sample (recent):');
  for (const t of transactions.slice(0, 15)) {
    const uname = userNames.get(t.userId) ?? t.userId;
    lines.push(`    - ${t.createdAt.toISOString().slice(0, 10)} ${uname} ${t.type} $${Number(t.amount).toFixed(2)} ${t.description ?? ''}`);
  }
  lines.push('--- End Admin System Context ---');
  return lines.join('\n');
}
