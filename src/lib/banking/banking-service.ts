/**
 * Single source of truth for financial data. Server-only.
 * Used by dashboard and chat tools. All queries MUST be scoped by authenticated userId.
 * When USE_DEMO_FINANCE_DATA=true, reads from SQLite demo DB if session user email matches a demo user.
 */

import { prisma } from '@/lib/db';
import { createHash } from 'crypto';
import {
  getDemoUserIdByEmail,
  getBalancesFromDemoDb,
  getRecentTransactionsFromDemoDb,
  getAccountsFromDemoDb,
} from './demo-db-read';
import { TRANSFER_LIMITS } from '@/lib/config/limits';

const USE_DEMO_FINANCE_DATA = process.env.USE_DEMO_FINANCE_DATA === 'true';

export type Balances = {
  checking: number;
  savings: number;
  creditCardBalance: number;
  creditLimit: number;
  availableCredit: number;
  asOf: string;
};

export type RecentTransaction = {
  type: string;
  amount: number;
  description: string | null;
  date: string;
};

export type CreditProfile = {
  utilization: number;
  utilizationPercent: string;
  paymentHistorySummary: string;
  simulatedScoreRange: string;
  recommendedActions: string[];
  creditLimit: number;
  currentBalance: number;
};

/**
 * Get balances from same data source as dashboard. Tenant-scoped by userId.
 */
export async function getBalances(userId: string): Promise<Balances> {
  if (USE_DEMO_FINANCE_DATA) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const demoUserId = user?.email ? getDemoUserIdByEmail(user.email) : null;
    if (demoUserId) return getBalancesFromDemoDb(demoUserId);
  }

  const accounts = await prisma.account.findMany({
    where: { userId, status: 'active' },
    orderBy: { type: 'asc' },
  });

  let checking = 0;
  let savings = 0;
  let creditCardBalance = 0;
  for (const a of accounts) {
    const bal = Number(a.balance);
    if (a.type === 'checking') checking = bal;
    else if (a.type === 'savings') savings = bal;
    else if (a.type === 'credit') creditCardBalance = bal; // typically negative (amount owed)
  }

  const creditApp = await prisma.application.findFirst({
    where: { userId, type: 'credit_card', status: 'approved' },
  });
  const creditLimit =
    creditApp?.amount != null
      ? Number(creditApp.amount)
      : (creditApp?.metadata as { limit?: number } | null)?.limit ?? 0;
  const availableCredit = Math.max(0, creditLimit + creditCardBalance); // credit balance is negative when owed

  const asOf = new Date().toISOString();
  return {
    checking,
    savings,
    creditCardBalance,
    creditLimit,
    availableCredit,
    asOf,
  };
}

export type AccountRow = { id: string; type: string; accountNumber: string; status: string };

/**
 * Get accounts for dashboard. Same source as balances (Prisma or demo SQLite).
 */
export async function getAccounts(userId: string): Promise<AccountRow[]> {
  if (USE_DEMO_FINANCE_DATA) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const demoUserId = user?.email ? getDemoUserIdByEmail(user.email) : null;
    if (demoUserId) return getAccountsFromDemoDb(demoUserId);
  }
  const accounts = await prisma.account.findMany({
    where: { userId, status: 'active' },
    orderBy: { type: 'asc' },
  });
  return accounts.map((a) => ({
    id: a.id,
    type: a.type,
    accountNumber: a.accountNumber,
    status: a.status,
  }));
}

/**
 * Get recent transactions. Same source as dashboard. Tenant-scoped.
 */
export async function getRecentTransactions(
  userId: string,
  limit = 10
): Promise<RecentTransaction[]> {
  if (USE_DEMO_FINANCE_DATA) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const demoUserId = user?.email ? getDemoUserIdByEmail(user.email) : null;
    if (demoUserId) return getRecentTransactionsFromDemoDb(demoUserId, limit);
  }

  const tx = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return tx.map((t) => ({
    type: t.type,
    amount: Number(t.amount),
    description: t.description ?? null,
    date: t.createdAt.toISOString(),
  }));
}

/**
 * Credit profile for eligibility / utilization. Simulated; no proprietary thresholds disclosed.
 */
export async function getCreditProfile(userId: string): Promise<CreditProfile> {
  const balances = await getBalances(userId);
  const currentBalance = Math.abs(balances.creditCardBalance);
  const limit = balances.creditLimit;
  const utilization = limit > 0 ? currentBalance / limit : 0;
  const utilizationPercent = limit > 0 ? ((currentBalance / limit) * 100).toFixed(1) + '%' : '0%';

  let paymentHistorySummary = 'No credit account or history on file.';
  const tx = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 24,
  });
  const payments = tx.filter((t) => t.type === 'payment' || t.type === 'credit card payment');
  if (payments.length > 0) {
    paymentHistorySummary = `You have ${payments.length} recent payment(s) on file. Keeping utilization low and paying on time supports credit health.`;
  } else if (limit > 0) {
    paymentHistorySummary = 'Payment history is still building. On-time payments help improve eligibility.';
  }

  const recommendedActions: string[] = [];
  if (utilization > 0.3) {
    recommendedActions.push('Consider paying down your card balance to lower utilization (under 30% is often favorable).');
  }
  if (limit === 0) {
    recommendedActions.push('You may apply for a credit card in the Apply section to establish a credit line.');
  }

  return {
    utilization,
    utilizationPercent,
    paymentHistorySummary,
    simulatedScoreRange: 'Eligibility is based on utilization, payment history, and account tenure. We do not disclose internal score ranges.',
    recommendedActions,
    creditLimit: limit,
    currentBalance,
  };
}

/**
 * Simulated credit increase request. Returns submitted status; no real underwriting.
 * For chat: also returns approved, newLimit, effectiveDate, reason for tool output.
 */
export async function requestCreditIncrease(
  userId: string,
  amount: number,
  reason: string
): Promise<{ status: string; message: string; approved?: boolean; newLimit?: number; effectiveDate?: string; reason?: string }> {
  await prisma.auditEvent.create({
    data: {
      eventType: 'CREDIT_INCREASE_REQUEST',
      userId,
      metadata: { amount, reason: reason.slice(0, 200), simulated: true },
    },
  });
  const effectiveDate = new Date().toISOString().slice(0, 10);
  return {
    status: 'submitted',
    message: `Your request for a credit limit increase of $${amount.toLocaleString()} has been submitted for review. You will receive a decision by mail or in-app notification. This is a simulation.`,
    approved: true,
    newLimit: amount,
    effectiveDate,
    reason: 'Simulated approval for demo.',
  };
}

export type TransferResult = {
  transactionId: string;
  postedAt: string;
  newBalances: Balances;
};

/**
 * Transfer funds between user's own accounts. Atomic. Enforces limits and ownership.
 */
export async function transferFunds(
  userId: string,
  fromAccount: string,
  toAccount: string,
  amount: number
): Promise<TransferResult> {
  if (USE_DEMO_FINANCE_DATA) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const demoUserId = user?.email ? getDemoUserIdByEmail(user.email) : null;
    if (demoUserId) {
      throw new Error('Transfers are not available in demo mode. Use the full app to transfer funds.');
    }
  }

  if (amount < TRANSFER_LIMITS.minAmount || amount > TRANSFER_LIMITS.maxPerTransfer) {
    throw new Error(`Amount must be between $${TRANSFER_LIMITS.minAmount} and $${TRANSFER_LIMITS.maxPerTransfer.toLocaleString()}.`);
  }
  if (fromAccount === toAccount) {
    throw new Error('From and to accounts must be different.');
  }

  const accounts = await prisma.account.findMany({
    where: { userId, status: 'active' },
    orderBy: { type: 'asc' },
  });
  const fromAcc = accounts.find((a) => a.type === fromAccount);
  const toAcc = accounts.find((a) => a.type === toAccount);
  if (!fromAcc || !toAcc) {
    throw new Error('One or both accounts not found. Only checking and savings are supported for transfers.');
  }

  const fromBalance = Number(fromAcc.balance);
  if (fromBalance < amount) {
    throw new Error('Insufficient funds in the source account.');
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const transferCount = await prisma.transaction.count({
    where: {
      userId,
      type: 'transfer',
      createdAt: { gte: todayStart },
    },
  });
  if (transferCount >= TRANSFER_LIMITS.maxPerDay) {
    throw new Error(`Daily transfer limit (${TRANSFER_LIMITS.maxPerDay}) reached. Try again tomorrow.`);
  }

  const reference = `tx-${Date.now()}-${createHash('sha256').update(userId + fromAcc.id + toAcc.id + amount).digest('hex').slice(0, 8)}`;
  const postedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: fromAcc.id },
      data: { balance: { decrement: amount } },
    });
    await tx.account.update({
      where: { id: toAcc.id },
      data: { balance: { increment: amount } },
    });
    const t = await tx.transaction.create({
      data: {
        userId,
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        type: 'transfer',
        amount,
        description: `Transfer from ${fromAccount} to ${toAccount}`,
        reference,
      },
    });
    return t;
  });

  const newBalances = await getBalances(userId);
  return {
    transactionId: result.id,
    postedAt: postedAt.toISOString(),
    newBalances,
  };
}

/**
 * Admin-only: top up an account (credit). Creates a transaction and updates balance.
 * @param userId - owner of the account
 * @param accountIdOrType - account id (cuid) or type 'checking' | 'savings'
 * @param amount - amount to add (positive number)
 * @param adminUserId - admin performing the action (for audit)
 */
export async function adminTopUpAccount(
  userId: string,
  accountIdOrType: string,
  amount: number,
  adminUserId: string
): Promise<{ success: boolean; accountId: string; newBalance: number; transactionId: string; error?: string }> {
  if (amount <= 0) {
    return { success: false, accountId: '', newBalance: 0, transactionId: '', error: 'Amount must be positive' };
  }
  let account = null;
  if (accountIdOrType === 'checking' || accountIdOrType === 'savings') {
    account = await prisma.account.findFirst({
      where: { userId, type: accountIdOrType, status: 'active' },
    });
  } else {
    account = await prisma.account.findFirst({
      where: { id: accountIdOrType, userId, status: 'active' },
    });
  }
  if (!account) {
    return { success: false, accountId: '', newBalance: 0, transactionId: '', error: 'Account not found' };
  }
  const reference = `admin-topup-${Date.now()}-${createHash('sha256').update(adminUserId + account.id + amount).digest('hex').slice(0, 8)}`;
  const result = await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: account!.id },
      data: { balance: { increment: amount } },
    });
    const t = await tx.transaction.create({
      data: {
        userId,
        fromAccountId: null,
        toAccountId: account!.id,
        type: 'admin_topup',
        amount,
        description: `Admin top-up by ${adminUserId}`,
        reference,
      },
    });
    const updated = await tx.account.findUnique({ where: { id: account!.id } });
    return { transaction: t, newBalance: updated ? Number(updated.balance) : 0 };
  });
  return {
    success: true,
    accountId: account.id,
    newBalance: result.newBalance,
    transactionId: result.transaction.id,
  };
}

/**
 * Compute a snapshot hash for correlation: dashboard and chat use the same formula.
 * snapshotHash = sha256(JSON.stringify(balances) + timestampBucket).
 * timestampBucket = floor(now / 300000) * 300000 (5-minute bucket in ms).
 */
export function computeSnapshotHash(balances: Balances): string {
  const bucket = Math.floor(Date.now() / 300_000) * 300_000;
  const payload = JSON.stringify({
    checking: balances.checking,
    savings: balances.savings,
    creditCardBalance: balances.creditCardBalance,
    creditLimit: balances.creditLimit,
    bucket,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
