/**
 * Minimal tests for demo finance pipeline: db-init (when better-sqlite3 built), security-events.
 * Run: pnpm exec tsx tests/demo-finance-pipeline.test.ts
 * Note: db:init requires native better-sqlite3; run "pnpm rebuild better-sqlite3" if needed.
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const DB_PATH = path.join(process.cwd(), 'data', 'db', 'app.sqlite');

async function main() {
  let sqliteOk = false;
  try {
    if (!fs.existsSync(path.dirname(DB_PATH))) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    execSync('pnpm run db:init', { cwd: process.cwd(), stdio: 'pipe' });
    assert(fs.existsSync(DB_PATH), 'DB file exists after db:init');
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    db.close();
    const names = tables.map((t) => t.name);
    assert(names.includes('users'), 'users table exists');
    assert(names.includes('accounts'), 'accounts table exists');
    assert(names.includes('transactions'), 'transactions table exists');
    assert(names.includes('chat_events'), 'chat_events table exists');
    sqliteOk = true;
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (msg.includes('bindings') || msg.includes('better_sqlite3')) {
      console.log('Skipping db:init test (better-sqlite3 native module not built; run: pnpm rebuild better-sqlite3)');
    } else throw e;
  }

  try {
    const base = process.env.APP_BASE_URL || 'http://localhost:5000';
    const res = await fetch(`${base}/api/admin/security-events`);
    assert(res.status === 403, 'security-events returns 403 when not authenticated');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      console.log('Server not running; skipping security-events 403 check');
    } else throw e;
  }

  console.log('Demo finance pipeline tests passed' + (sqliteOk ? '' : ' (db:init skipped)'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
