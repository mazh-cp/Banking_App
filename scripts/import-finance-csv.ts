#!/usr/bin/env node
/**
 * Unzip data/seed/secure_ai_chat_demo_data_csvs.zip, validate CSV headers,
 * and upsert into data/db/app.sqlite. Server-only. Run: pnpm run import:finance
 * users.csv may include optional: last4 (hashed at import), ssn_last4_hash, dob_masked, city, state.
 */

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { hashLast4 } from '../src/lib/security/ssn-last4';

const SEED_ZIP = path.join(process.cwd(), 'data', 'seed', 'secure_ai_chat_demo_data_csvs.zip');
const DB_PATH = path.join(process.cwd(), 'data', 'db', 'app.sqlite');

const USERS_HEADERS_REQUIRED = ['id', 'email', 'first_name', 'last_name'];
const USERS_HEADERS_OPTIONAL = ['last4', 'ssn_last4_hash', 'dob_masked', 'city', 'state'];
const ACCOUNTS_HEADERS = ['id', 'user_id', 'type', 'account_number', 'balance', 'currency', 'status'];
const TRANSACTIONS_HEADERS = ['id', 'user_id', 'from_account_id', 'to_account_id', 'type', 'amount', 'description', 'reference', 'created_at'];

function assertHeaders(actual: string[], required: string[], file: string): void {
  const a = actual.map((h) => h.trim().toLowerCase());
  const e = required.map((h) => h.toLowerCase());
  const missing = e.filter((h) => !a.includes(h));
  if (missing.length) {
    throw new Error(`${file}: missing required columns: ${missing.join(', ')}. Got: ${actual.join(', ')}`);
  }
}

function ensureDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`DB not initialized. Run: pnpm run db:init`);
  }
  return new Database(DB_PATH);
}

async function main(): Promise<void> {
  if (!fs.existsSync(SEED_ZIP)) {
    console.error('Seed zip not found at', SEED_ZIP);
    console.error('Place secure_ai_chat_demo_data_csvs.zip in data/seed/');
    process.exit(1);
  }

  const zip = new AdmZip(SEED_ZIP);
  const entries = zip.getEntries();
  const csvFiles: Record<string, Buffer> = {};
  for (const e of entries) {
    if (!e.isDirectory && e.entryName.endsWith('.csv')) {
      const name = path.basename(e.entryName);
      csvFiles[name] = e.getData();
    }
  }

  const usersCsv = csvFiles['users.csv'];
  const accountsCsv = csvFiles['accounts.csv'];
  const transactionsCsv = csvFiles['transactions_12_months.csv'] ?? csvFiles['transactions_last_12_months.csv'];
  if (!usersCsv || !accountsCsv || !transactionsCsv) {
    console.error('Zip must contain users.csv, accounts.csv, and transactions_12_months.csv (or transactions_last_12_months.csv). Found:', Object.keys(csvFiles));
    process.exit(1);
  }

  const usersRows = parse(usersCsv.toString(), { columns: true, skip_empty_lines: true, trim: true });
  const accountsRows = parse(accountsCsv.toString(), { columns: true, skip_empty_lines: true, trim: true });
  const transactionsRows = parse(transactionsCsv.toString(), { columns: true, skip_empty_lines: true, trim: true });

  if (usersRows.length) {
    assertHeaders(Object.keys(usersRows[0]), USERS_HEADERS_REQUIRED, 'users.csv');
  }
  if (accountsRows.length) {
    assertHeaders(Object.keys(accountsRows[0]), ACCOUNTS_HEADERS, 'accounts.csv');
  }
  if (transactionsRows.length) {
    assertHeaders(Object.keys(transactionsRows[0]), TRANSACTIONS_HEADERS, 'transactions_12_months.csv');
  }

  const db = ensureDb();
  const insUser = db.prepare(`
    INSERT INTO users (id, email, first_name, last_name, ssn_last4_hash, dob_masked, city, state, last4_display) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET email=excluded.email, first_name=excluded.first_name, last_name=excluded.last_name,
      ssn_last4_hash=COALESCE(excluded.ssn_last4_hash, users.ssn_last4_hash),
      dob_masked=COALESCE(excluded.dob_masked, users.dob_masked),
      city=COALESCE(excluded.city, users.city), state=COALESCE(excluded.state, users.state),
      last4_display=COALESCE(excluded.last4_display, users.last4_display)
  `);
  const insAccount = db.prepare(`
    INSERT INTO accounts (id, user_id, type, account_number, balance, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, type=excluded.type, account_number=excluded.account_number, balance=excluded.balance, currency=excluded.currency, status=excluded.status
  `);
  const insTx = db.prepare(`
    INSERT INTO transactions (id, user_id, from_account_id, to_account_id, type, amount, description, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, from_account_id=excluded.from_account_id, to_account_id=excluded.to_account_id, type=excluded.type, amount=excluded.amount, description=excluded.description, reference=excluded.reference, created_at=excluded.created_at
  `);

  const userInserts: (string | null)[] = [];
  for (const r of usersRows) {
    let ssnHash: string | null = (r as Record<string, unknown>).ssn_last4_hash ? String((r as Record<string, unknown>).ssn_last4_hash).trim() || null : null;
    if (!ssnHash && (r as Record<string, unknown>).last4 && /^\d{4}$/.test(String((r as Record<string, unknown>).last4).trim())) {
      ssnHash = await hashLast4(String((r as Record<string, unknown>).last4).trim());
    }
    const dob = (r as Record<string, unknown>).dob_masked ? String((r as Record<string, unknown>).dob_masked).trim() || null : null;
    const city = (r as Record<string, unknown>).city ? String((r as Record<string, unknown>).city).trim() || null : null;
    const state = (r as Record<string, unknown>).state ? String((r as Record<string, unknown>).state).trim() || null : null;
    const last4Display = (r as Record<string, unknown>).last4_display ? String((r as Record<string, unknown>).last4_display).trim().slice(-4) || null : null;
    userInserts.push(r.id ?? (r as Record<string, unknown>).user_id as string, r.email, r.first_name, r.last_name, ssnHash, dob, city, state, last4Display);
  }

  const runMany = db.transaction(() => {
    for (let i = 0; i < userInserts.length; i += 9) {
      insUser.run(
        userInserts[i]!,
        userInserts[i + 1]!,
        userInserts[i + 2]!,
        userInserts[i + 3]!,
        userInserts[i + 4],
        userInserts[i + 5],
        userInserts[i + 6],
        userInserts[i + 7],
        userInserts[i + 8]
      );
    }
    for (const r of accountsRows) {
      insAccount.run(r.id, r.user_id, r.type, r.account_number, Number(r.balance), r.currency ?? 'USD', r.status ?? 'active');
    }
    for (const r of transactionsRows) {
      insTx.run(
        r.id,
        r.user_id,
        r.from_account_id ?? null,
        r.to_account_id ?? null,
        r.type,
        Number(r.amount),
        r.description ?? null,
        r.reference ?? null,
        r.created_at ?? new Date().toISOString()
      );
    }
  });
  runMany();
  db.close();
  console.log('Imported:', usersRows.length, 'users,', accountsRows.length, 'accounts,', transactionsRows.length, 'transactions');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
