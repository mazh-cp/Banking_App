# FinGuard Bank Simulator – DevOps Guide

## Requirements

- Node 18+, pnpm
- PostgreSQL (for main app)
- Optional: Redis (if using Redis-backed rate limiting)
- Optional: SQLite (for demo finance pipeline at `data/db/app.sqlite`)

## Environment

- Copy `.env.example` to `.env` and set at least:
  - `DATABASE_URL`
  - `SESSION_SECRET` (min 32 chars)
  - `CSRF_SECRET` or use `SESSION_SECRET`
- Production: set `NODE_ENV=production`, `SECRETS_ENCRYPTION_KEY` (32-byte hex), and API keys or use Admin Settings.

## Database

```bash
pnpm prisma db push    # or migrate
pnpm run db:seed
```

## Build and Run

```bash
pnpm install
pnpm run build
pnpm start   # port 5000
```

## Release Gate (pre-release)

Run before tagging a release; do not push to remote from this branch.

```bash
./scripts/release-gate.sh
```

Optional: skip AppSec steps if tools not installed:

```bash
./scripts/release-gate.sh --skip-appsec
```

## AppSec Scripts (local)

- **Dependency audit**: `./scripts/security/deps-audit.sh` (uses `pnpm audit`).
- **Secret scan**: `./scripts/security/secret-scan.sh` (uses gitleaks if installed).
- **SAST**: `./scripts/security/sast.sh` (uses semgrep if installed).

## File Upload and RAG

- Set `UPLOAD_DIR` to a persistent path (e.g. `/opt/finguard/data/uploads`).
- For RAG: set `OPENAI_API_KEY` (or store in Admin Settings). Set `RAG_ENABLED=false` to disable.

## Demo Mode

- Set `USE_DEMO_FINANCE_DATA=true` and run `pnpm run db:init`, then `pnpm run import:finance` with the seed zip in `data/seed/`.

## Logging and Audit

- Application logs: use secure logger (redacts PII). Audit events are stored in `AuditEvent` and `ChatAudit`; do not log raw API keys or SSN.

## Idempotency for Money-Like Actions

- **Applications**: Submit endpoints create records with unique constraints (e.g. user + type + status). Duplicate submissions are handled via upsert or unique reference.
- **Banking tools** (balances, transactions): Read-only; no double-debit. Writes to ledger (if any) must use idempotency keys or unique references in production.
- **Ledger integrity**: Run `pnpm exec tsx tests/ledger-integrity.test.ts` to verify balance/transaction consistency after data changes.
