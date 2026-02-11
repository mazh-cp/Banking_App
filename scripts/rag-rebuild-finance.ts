#!/usr/bin/env node
/**
 * Build per-user RAG docs (system-of-record, RAG-friendly views) from authoritative
 * users/accounts/transactions. Creates U{id}_profile.md, U{id}_accounts.md,
 * U{id}_transactions_rolling_12mo.md with masked PII (no raw SSN; last4 as ****).
 * Run: pnpm run rag:rebuild-finance. Requires OPENAI_API_KEY.
 */

import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const CHUNK_SIZE = 800;
const OVERLAP = 100;

const prisma = new PrismaClient();
const RAG_DIR = path.join(process.cwd(), 'data', 'rag', 'users');

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start = end - (end === text.length ? 0 : OVERLAP);
  }
  return chunks.filter((c) => c.length > 0);
}

async function getEmbedding(openai: OpenAI, text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  const emb = res.data[0]?.embedding;
  if (!emb || !Array.isArray(emb)) throw new Error('No embedding');
  return emb;
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY required');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey });

  const useDemo = process.env.USE_DEMO_FINANCE_DATA === 'true';
  let userIdsToBuild: { prismaUserId: string; demoUserId?: string }[] = [];

  if (useDemo) {
    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'data', 'db', 'app.sqlite');
    if (!fs.existsSync(dbPath)) {
      console.error('Demo DB not found. Run pnpm run db:init and pnpm run import:finance');
      process.exit(1);
    }
    const db = new Database(dbPath);
    const demoUsers = db.prepare('SELECT id, email FROM users').all() as { id: string; email: string }[];
    db.close();
    for (const u of demoUsers) {
      const prismaUser = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
      if (prismaUser) userIdsToBuild.push({ prismaUserId: prismaUser.id, demoUserId: u.id });
    }
  } else {
    const users = await prisma.user.findMany({
      where: { accounts: { some: {} } },
      select: { id: true },
    });
    userIdsToBuild = users.map((u) => ({ prismaUserId: u.id }));
  }

  for (const { prismaUserId, demoUserId } of userIdsToBuild) {
    const displayId = demoUserId ?? prismaUserId;
    const userDir = path.join(RAG_DIR, prismaUserId);
    fs.mkdirSync(userDir, { recursive: true });

    const uPrefix = `U${displayId}`;
    let profileMd = '';
    let accountsMd = '';
    let transactionsMd = '';

    if (useDemo && demoUserId) {
      const Database = require('better-sqlite3');
      const db = new Database(path.join(process.cwd(), 'data', 'db', 'app.sqlite'));
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(demoUserId) as {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        dob_masked?: string | null;
        city?: string | null;
        state?: string | null;
      } | undefined;
      const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(demoUserId) as { type: string; account_number: string; balance: number }[];
      const tx = db.prepare('SELECT type, amount, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 500').all(demoUserId) as { type: string; amount: number; description: string | null; created_at: string }[];
      db.close();
      const dobMasked = user?.dob_masked ? '**/**/****' : '';
      const cityState = [user?.city, user?.state].filter(Boolean).join(', ') || '';
      profileMd = `# ${uPrefix} Profile\nName: ${user?.first_name ?? ''} ${user?.last_name ?? ''}\nEmail: ${user?.email ?? ''}\nDOB: ${dobMasked}\nLocation: ${cityState}\nSSN last 4: ****\n`;
      accountsMd = `# ${uPrefix} Accounts\n` + accounts.map((a) => `- ${a.type}: ****${String(a.account_number).slice(-4)} Balance: $${Number(a.balance).toFixed(2)}`).join('\n');
      const totalIn = tx.filter((t) => t.type === 'deposit' || t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
      const totalOut = tx.filter((t) => t.type !== 'deposit' && t.type !== 'credit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const merchants: Record<string, number> = {};
      for (const t of tx) {
        const desc = (t.description ?? t.type).replace(/\d+/g, '').trim().slice(0, 40) || t.type;
        merchants[desc] = (merchants[desc] ?? 0) + Math.abs(Number(t.amount));
      }
      const topMerchants = Object.entries(merchants).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, amt]) => `  ${name}: $${amt.toFixed(2)}`).join('\n');
      transactionsMd = `# ${uPrefix} Transactions (rolling 12 months)\nSummary: ${tx.length} transactions. Total inflows: $${totalIn.toFixed(2)}; total outflows: $${totalOut.toFixed(2)}.\nTop merchants/categories:\n${topMerchants}\n\nRecent:\n` + tx.slice(0, 100).map((t) => `- ${t.created_at} ${t.type} $${Number(t.amount).toFixed(2)} ${t.description ?? ''}`).join('\n');
    } else {
      const user = await prisma.user.findUnique({ where: { id: prismaUserId }, select: { email: true, firstName: true, lastName: true } });
      const accounts = await prisma.account.findMany({ where: { userId: prismaUserId }, orderBy: { type: 'asc' } });
      const tx = await prisma.transaction.findMany({ where: { userId: prismaUserId }, orderBy: { createdAt: 'desc' }, take: 500 });
      profileMd = `# ${uPrefix} Profile\nName: ${user?.firstName ?? ''} ${user?.lastName ?? ''}\nEmail: ${user?.email ?? ''}\nDOB: **/**/****\nSSN last 4: ****\n`;
      accountsMd = `# ${uPrefix} Accounts\n` + accounts.map((a) => `- ${a.type}: ****${a.accountNumber.slice(-4)} Balance: $${Number(a.balance).toFixed(2)}`).join('\n');
      const totalIn = tx.filter((t) => t.type === 'deposit' || t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
      const totalOut = tx.filter((t) => t.type !== 'deposit' && t.type !== 'credit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const merchants: Record<string, number> = {};
      for (const t of tx) {
        const desc = ((t.description ?? t.type) as string).replace(/\d+/g, '').trim().slice(0, 40) || t.type;
        merchants[desc] = (merchants[desc] ?? 0) + Math.abs(Number(t.amount));
      }
      const topMerchants = Object.entries(merchants).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, amt]) => `  ${name}: $${amt.toFixed(2)}`).join('\n');
      transactionsMd = `# ${uPrefix} Transactions (rolling 12 months)\nSummary: ${tx.length} transactions. Total inflows: $${totalIn.toFixed(2)}; total outflows: $${totalOut.toFixed(2)}.\nTop merchants/categories:\n${topMerchants}\n\nRecent:\n` + tx.slice(0, 100).map((t) => `- ${t.createdAt.toISOString()} ${t.type} $${Number(t.amount).toFixed(2)} ${t.description ?? ''}`).join('\n');
    }

    const profileFile = `${uPrefix}_profile.md`;
    const accountsFile = `${uPrefix}_accounts.md`;
    const transactionsFile = `${uPrefix}_transactions_rolling_12mo.md`;
    fs.writeFileSync(path.join(userDir, profileFile), profileMd);
    fs.writeFileSync(path.join(userDir, accountsFile), accountsMd);
    fs.writeFileSync(path.join(userDir, transactionsFile), transactionsMd);

    const allChunks: { content: string; docType: string }[] = [];
    for (const [name, text] of [['profile', profileMd], ['accounts', accountsMd], ['transactions_rolling_12mo', transactionsMd]]) {
      const parts = chunkText(text);
      for (const p of parts) allChunks.push({ content: p, docType: name === 'profile' ? 'profile' : name === 'accounts' ? 'accounts' : 'transactions_rolling_12mo' });
    }

    await prisma.financeRagChunk.deleteMany({ where: { userId: prismaUserId } });
    for (let i = 0; i < allChunks.length; i++) {
      const { content, docType } = allChunks[i];
      const embedding = await getEmbedding(openai, content);
      await prisma.financeRagChunk.create({
        data: { userId: prismaUserId, content, embedding, docType: 'finance', chunkIndex: i },
      });
    }
    console.log('Indexed', allChunks.length, 'chunks for user', prismaUserId);
  }

  console.log('RAG finance rebuild done for', userIdsToBuild.length, 'users');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
