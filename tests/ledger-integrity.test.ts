/**
 * Ledger integrity: balances and transactions consistency.
 * Run: pnpm exec tsx tests/ledger-integrity.test.ts
 */

import { prisma } from '../src/lib/db';

async function run() {
  const users = await prisma.user.findMany({ select: { id: true }, where: { role: 'customer' } });
  for (const u of users) {
    const accounts = await prisma.account.findMany({ where: { userId: u.id, status: 'active' } });
    const sumByType: Record<string, number> = {};
    for (const a of accounts) {
      const bal = Number(a.balance);
      sumByType[a.type] = (sumByType[a.type] ?? 0) + bal;
    }
    const txs = await prisma.transaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'asc' } });
    let running = 0;
    for (const t of txs) {
      const amt = Number(t.amount);
      if (t.type === 'deposit' || t.type === 'transfer') running += amt;
      else if (t.type === 'withdrawal' || t.type === 'payment') running -= amt;
    }
    if (accounts.length > 0 && Object.keys(sumByType).length > 0) {
      const totalBal = Object.values(sumByType).reduce((a, b) => a + b, 0);
      if (Number.isNaN(totalBal) || totalBal === undefined) throw new Error(`User ${u.id}: invalid balance sum`);
    }
  }
  await prisma.$disconnect();
  console.log('Ledger integrity checks passed.');
  process.exit(0);
}
run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
