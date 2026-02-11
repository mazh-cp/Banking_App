/**
 * SQLite demo finance DB (data/db/app.sqlite). Server-only.
 * Tables: users, accounts, transactions, chat_events.
 */

import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data', 'db');
const DB_PATH = path.join(DB_DIR, 'app.sqlite');

let _db: import('better-sqlite3').Database | null = null;

function getDbPath(): string {
  return DB_PATH;
}

/** Open SQLite DB; creates dir and file if needed. */
function openDb(): import('better-sqlite3').Database {
  if (_db) return _db;
  // Dynamic require so Next.js can bundle correctly
  const Database = require('better-sqlite3');
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  _db = db;
  return db;
}

/** Initialize schema (idempotent). */
export function initSchema(db?: import('better-sqlite3').Database): void {
  const sqlite = db ?? openDb();
  sqlite.exec(`
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
  // Migrate existing users table: add columns if missing (no raw SSN; last4 hashed only)
  const columnsToAdd = [
    { name: 'ssn_last4_hash', sql: 'ALTER TABLE users ADD COLUMN ssn_last4_hash TEXT' },
    { name: 'dob_masked', sql: 'ALTER TABLE users ADD COLUMN dob_masked TEXT' },
    { name: 'city', sql: 'ALTER TABLE users ADD COLUMN city TEXT' },
    { name: 'state', sql: 'ALTER TABLE users ADD COLUMN state TEXT' },
    { name: 'last4_display', sql: 'ALTER TABLE users ADD COLUMN last4_display TEXT' },
  ];
  for (const { name, sql } of columnsToAdd) {
    try {
      const info = sqlite.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = ?").get(name);
      if (!info) sqlite.exec(sql);
    } catch {
      // ignore
    }
  }
}

export function getDemoDb(): import('better-sqlite3').Database {
  return openDb();
}

export type ChatEventInsert = {
  userId?: string | null;
  requestId?: string | null;
  eventType: string;
  labels?: string | null; // JSON string
  action: string;
};

/** Log a chat/Lakera event to SQLite chat_events. No-op if DB not available. */
export function logChatEvent(ev: ChatEventInsert): void {
  try {
    const db = openDb();
    db.prepare(
      'INSERT INTO chat_events (user_id, request_id, event_type, labels, action) VALUES (?, ?, ?, ?, ?)'
    ).run(
      ev.userId ?? null,
      ev.requestId ?? null,
      ev.eventType,
      ev.labels ?? null,
      ev.action
    );
  } catch {
    // non-fatal
  }
}

export { getDbPath, DB_PATH, DB_DIR };
