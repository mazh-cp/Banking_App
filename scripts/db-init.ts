#!/usr/bin/env node
/**
 * Initialize SQLite demo DB at data/db/app.sqlite.
 * Creates tables: users, accounts, transactions, chat_events.
 * Run: pnpm run db:init
 */

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const DB_DIR = path.join(process.cwd(), 'data', 'db');
const DB_PATH = path.join(DB_DIR, 'app.sqlite');

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      ssn_last4_hash TEXT,
      dob_masked TEXT,
      city TEXT,
      state TEXT,
      last4_display TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      account_number TEXT NOT NULL UNIQUE,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      from_account_id TEXT,
      to_account_id TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      reference TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS chat_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      request_id TEXT,
      event_type TEXT NOT NULL,
      labels TEXT,
      action TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_events_user_id ON chat_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_events_created_at ON chat_events(created_at);
  `);
  const cols = ['ssn_last4_hash', 'dob_masked', 'city', 'state', 'last4_display'];
  for (const name of cols) {
    try {
      const info = db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = ?").get(name) as { '1'?: number } | undefined;
      if (!info) db.exec(`ALTER TABLE users ADD COLUMN ${name} TEXT`);
    } catch {
      // ignore
    }
  }
}

function main(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initSchema(db);
  db.close();
  console.log('DB initialized at', DB_PATH);
}

main();
