/**
 * Read balances/transactions from SQLite demo DB. Server-only.
 * Used when USE_DEMO_FINANCE_DATA=true and session user email matches a demo user.
 */

import { getDemoDb } from '@/lib/sqlite-db';
import type { Balances, RecentTransaction } from './banking-service';

export type DemoAccount = { id: string; type: string; accountNumber: string; status: string };

export function getDemoUserIdByEmail(email: string): string | null {
  try {
    const db = getDemoDb();
    const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** SSN last4 hash for identity gate: validate last4 against users.csv (demo). */
export function getDemoUserSsnLast4HashByEmail(email: string): string | null {
  try {
    const db = getDemoDb();
    const row = db.prepare('SELECT ssn_last4_hash FROM users WHERE email = ?').get(email) as { ssn_last4_hash: string | null } | undefined;
    return row?.ssn_last4_hash ?? null;
  } catch {
    return null;
  }
}

export function getBalancesFromDemoDb(demoUserId: string): Balances {
  const db = getDemoDb();
  const accounts = db.prepare('SELECT type, balance FROM accounts WHERE user_id = ? AND status = ?').all(demoUserId, 'active') as { type: string; balance: number }[];
  let checking = 0;
  let savings = 0;
  let creditCardBalance = 0;
  for (const a of accounts) {
    const bal = Number(a.balance);
    if (a.type === 'checking') checking = bal;
    else if (a.type === 'savings') savings = bal;
    else if (a.type === 'credit') creditCardBalance = bal;
  }
  const creditLimit = 0; // demo CSV may not have application; could extend later
  const availableCredit = Math.max(0, creditLimit + creditCardBalance);
  return {
    checking,
    savings,
    creditCardBalance,
    creditLimit,
    availableCredit,
    asOf: new Date().toISOString(),
  };
}

export function getRecentTransactionsFromDemoDb(demoUserId: string, limit: number): RecentTransaction[] {
  const db = getDemoDb();
  const rows = db
    .prepare('SELECT type, amount, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(demoUserId, limit) as { type: string; amount: number; description: string | null; created_at: string }[];
  return rows.map((t) => ({
    type: t.type,
    amount: Number(t.amount),
    description: t.description ?? null,
    date: t.created_at,
  }));
}

export function getAccountsFromDemoDb(demoUserId: string): DemoAccount[] {
  const db = getDemoDb();
  const rows = db
    .prepare('SELECT id, type, account_number, status FROM accounts WHERE user_id = ? AND status = ? ORDER BY type')
    .all(demoUserId, 'active') as { id: string; type: string; account_number: string; status: string }[];
  return rows.map((r) => ({ id: r.id, type: r.type, accountNumber: r.account_number, status: r.status }));
}
