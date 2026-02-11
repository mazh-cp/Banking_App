# FinGuard Bank Simulator

Production-ready Next.js (App Router) + TypeScript + Tailwind banking simulator with Postgres, Prisma, master prompt governance, Lakera Guard, risk scoring, compliance mapping, and multi-format file upload + RAG.

## Features

- **Banking simulation**: Dashboard, credit card / mortgage / auto loan applications, transactions, profile
- **Master prompt governance**: `lib/security/master-wrapper.ts` + `personas.ts` + `prompt-firewall.ts` – system prompt is always MASTER_WRAPPER + persona + bank policy + optional RAG; user input never alters system instructions
- **Secure chat** (`/chat`): Persona selector (support, underwriter, fraud analyst), Attack Simulation / Security Mode toggles, scenario presets. Pre/post Lakera scan, risk scoring (LOW/MEDIUM/HIGH/CRITICAL), categories and action (allowed/blocked/safe_rewrite) persisted to audit. **Maintenance mode**: if required AI keys are not configured, chat responds with “System is under Maintenance” (no LLM calls); admins see which keys are missing; events recorded in audit.
- **Files** (`/files`): Multi-format upload (PDF, DOC, DOCX, XLS, XLSX, CSV, TXT) → extract text → Lakera scan → FileScan + quarantined/approved → chunk scan before embedding; only approved non-quarantined files in RAG. Storage under `UPLOAD_DIR` (e.g. `/opt/finguard/data/uploads/{userId}/`), never exposed.
- **Identity verification (simulation)**: Profile → "Identity Verification" stores only **SSN last 4** (hashed at rest; never full SSN). Chat requires verification before answering balance/transactions/credit questions; 15‑minute TTL per session.
- **Admin**: `/admin/settings` (API keys: OpenAI, Anthropic, Lakera – encrypted at rest; Lakera keys via Admin Settings or `.env`), `/admin/activity` (global logins, chat, tool calls, uploads), `/admin/security-warnings` (Lakera blocks, verification failures, quarantined files), `/admin/audit`, `/admin/risk-map`, `/admin/compliance`, `/admin/demo`
- **Security**: Lakera v2 Guard runs on **every** chat prompt (pre-scan → block malicious → verification gate → tools + model → post-scan). Admin-stored secrets override env; keys never in client or API responses. Rate limiting, httpOnly cookies, CSRF. SSN last 4 is hashed only (bcrypt); never stored or logged in plaintext. Readiness check is server-side only; maintenance mode enforced before any LLM or Lakera call.
- **Infra**: Docker Compose (Postgres + optional Redis), Prisma schema + seed, `scripts/install.sh`, `scripts/deploy-azure-vm.sh`, Nginx + systemd

## Demo finance dataset (optional)

To use the server-side demo finance pipeline with CSV seed data:

1. Place `secure_ai_chat_demo_data_csvs.zip` in `data/seed/`. The zip must contain:
   - `users.csv` (id, email, first_name, last_name; optional: last4, ssn_last4_hash, dob_masked, city, state). If `last4` is present it is hashed at import; no raw SSN stored.
   - `accounts.csv` (id, user_id, type, account_number, balance, currency, status)
   - `transactions_12_months.csv` or `transactions_last_12_months.csv` (id, user_id, from_account_id, to_account_id, type, amount, description, reference, created_at)
2. Run: `pnpm run db:init` (creates SQLite at `data/db/app.sqlite`), then `pnpm run import:finance` (unzip, validate, upsert).
3. Set `USE_DEMO_FINANCE_DATA=true` in `.env`. Dashboard and chat use SQLite as the **system-of-record** for balances and history when the session user’s email matches a demo user.
4. Optional: `pnpm run rag:rebuild-finance` to build **RAG-friendly views** per user: `U{id}_profile.md` (name, masked DOB, city/state, SSN last 4 masked as ****), `U{id}_accounts.md`, `U{id}_transactions_rolling_12mo.md` (summaries, top merchants, totals). These are updated from the authoritative dataset so the model does not guess beyond what the dashboard shows.

**Identity verification gate (last 4 SSN):** Before any financial disclosure in chat, the user must provide last4. The server validates against `users.csv` (demo) or Profile-stored hash (Prisma). Only after verification is a short-lived `verified` state stored **server-side** (session); then RAG retrieval for that user_id is allowed. **POST /api/auth/verify-last4** with `{ "last4": "1234" }` performs this step.

**Retrieval rules (no cross-user leakage):** Every RAG query is scoped by `user_id`: only documents tagged with that user_id are retrieved. Finance RAG chunks are included only when the session is verified. No raw SSNs are embedded; only last4 masked (****) appears in RAG documents.

**Admin chat:** When logged in as **admin**, the chat receives an **Admin System Context** (server-side only) with: total users, and for each user — Name, Date of Birth (masked), Address (city/state), Last 4 SSN for verification (masked). It also includes accounts by type (Checking, Savings, Auto loan, Credit Card, Home loan) and transactions in the past 12 months. Admins can ask e.g. "How many users are in the system?" or "What is Alice's DOB?" and get answers from this context. Lakera Guard still screens all prompts and model output; the admin context is trusted server-generated data. For demo data, use `users.csv` with columns such as first_name, last_name, dob_masked, city, state, and optional `last4_display` (4 digits for admin verification display). Include users such as Alice, Bob Smith, Carol, Steve, Adam and account types Checking, Savings, Auto loan, Credit Card, Home loan for full admin/RAG use.

Lakera Guard v2 screens user prompt, retrieved context, and model output; all events are logged to `chat_events` (SQLite). Admin: **GET /api/admin/security-events** (query params: `from`, `to`, `user_id`, `action`).

## Quick start

```bash
cp .env.example .env
# Edit .env: DATABASE_URL, SESSION_SECRET, optional OPENAI_API_KEY, ANTHROPIC_API_KEY, LAKERA_GUARD_API_KEY

pnpm install
docker compose up -d postgres
pnpm prisma db push
pnpm db:seed
pnpm dev
```

Open http://localhost:5000 (redirects to /login) → Sign in with **alice.johnson@finguard.demo** / **Nx7#mKp2Lq**

## Static accounts (after seed)

All accounts use domain **@finguard.demo** and have unique random passwords. See [docs/DEMO_USERS.md](docs/DEMO_USERS.md) for the full table and SSN last 4.

| Email | Password | Role |
|-------|----------|------|
| alice.johnson@finguard.demo | Nx7#mKp2Lq | customer |
| bob.smith@finguard.demo | Qw9$vBn4Yr | customer |
| carol.williams@finguard.demo | Rt2!cXj6Ht | customer |
| admin@finguard.demo | Ad5@fGu8!dm | admin |
| readonly.viewer@finguard.demo | Ro3#vIe7Wq | readonly |
| adams.smith@finguard.demo | As1!mS9Kp | customer |
| alisha.khan@finguard.demo | Ak4$nHj2Lm | customer |
| sherry.goldberg@finguard.demo | Sg6#bGd8Rt | customer |
| david.warner@finguard.demo | Dw0!rWn3Yp | customer |

**Full demo reference:** See [docs/DEMO_USERS.md](docs/DEMO_USERS.md) for names, account details, **SSN last 4 for validation**, and SQLite demo notes for simulation.

**Admin bootstrap**: The seed creates one admin user (`admin@finguard.demo` / `Ad5@fGu8!dm`). Use this account to sign in and go to **Admin → Settings** to set API keys (stored encrypted). No other role can view or change keys.

**API key precedence**: Keys stored in Admin Settings (DB, encrypted) override environment variables. If no key is set in Settings, the app uses `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LAKERA_GUARD_API_KEY` / `LAKERA_API_KEY`, `LAKERA_PROJECT_ID` from `.env`. Set `SECRETS_ENCRYPTION_KEY` (32-byte hex or base64) in production to use Admin-stored secrets.

## Sign up (read-only)

Sign up creates **read-only** accounts only (view dashboard, transactions, chat, files; no applications or uploads).

## Tests

```bash
pnpm test
# Or: pnpm exec tsx tests/risk-scoring.test.ts
#     pnpm exec tsx tests/upload-scan.test.ts
#     pnpm exec tsx tests/demo-finance-pipeline.test.ts
```

## Azure Ubuntu VM deployment

1. Create an Ubuntu 22.04 VM (e.g. Azure). Install Node 20+, pnpm, Nginx.
2. On the VM, create `.env` with production values (DATABASE_URL, SESSION_SECRET, LAKERA_GUARD_API_KEY, etc.). Set `UPLOAD_DIR=/opt/finguard/data/uploads` and create that directory with correct ownership.
3. From your machine:
   ```bash
   ./scripts/deploy-azure-vm.sh azureuser@<vm-ip>
   ```
4. On the VM: `sudo systemctl start finguard-next`, `sudo nginx -t && sudo systemctl reload nginx`. Ensure Nginx is configured for your domain and TLS if needed.
5. Run migrations on the server if using a remote DB: `pnpm prisma db push`.

## Environment (.env.example)

- **Database**: `DATABASE_URL`
- **Session**: `SESSION_SECRET`, `SESSION_MAX_AGE_SECONDS`, `CSRF_SECRET`, `COOKIE_PREFIX`
- **Secrets (admin settings)**: `SECRETS_ENCRYPTION_KEY` (required for storing keys in DB; 32-byte hex or base64)
- **LLM (fallback)**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CHAT_PROVIDER`, `CHAT_MODEL_OPENAI`, `CHAT_MODEL_ANTHROPIC`
- **Security**: `LAKERA_GUARD_API_KEY` / `LAKERA_API_KEY`, `LAKERA_PROJECT_ID`, `CHAT_BLOCK_THRESHOLD`, `CHAT_SAFE_REWRITE_THRESHOLD`
- **RAG**: `RAG_ENABLED`, `OPENAI_EMBEDDING_MODEL`, `RAG_AUTO_APPROVE_LOW_MED`
- **Uploads**: `UPLOAD_DIR`, `MAX_FILE_UPLOAD_BYTES`
- **Limits**: `MAX_REQUEST_BODY_BYTES`, `MAX_CHAT_MESSAGE_LENGTH`, `RATE_LIMIT_REQUESTS_PER_MINUTE`

## Maintenance mode (missing AI keys)

If required keys are not set, the chat **never** calls an LLM and always returns:

- **Response**: `"System is under Maintenance"` (HTTP 200, normal chat payload with `meta.maintenance: true`).
- **Audit**: Each such request is logged as `AI_MAINTENANCE_MODE` (Admin → Audit).
- **Who sees what**: Only **admin** users see which keys are missing (e.g. `missingKeys: ["OPENAI_API_KEY"]`). Non-admin users see a generic “AI services temporarily unavailable” banner; no key names are exposed.

**Required keys:**

- **Provider**: Either `OPENAI_API_KEY` (when `CHAT_PROVIDER=openai`) or `ANTHROPIC_API_KEY` (when `CHAT_PROVIDER=anthropic`) must be set for chat to run.
- **Lakera**: If Security mode is on in the chat UI, or `REQUIRE_LAKERA_ALWAYS=true`, both `LAKERA_API_KEY` and `LAKERA_PROJECT_ID` must be set. Otherwise Lakera is optional.

Keys are read from Admin Settings (encrypted DB) first, then env (e.g. `.env`). See **Admin → Settings → System Readiness** for current status.

## Secure defaults

- Master wrapper + persona prompts; user input never concatenated into system prompt
- Lakera Guard pre-scan (user message + context) and post-scan (model output); block or safe-rewrite by threshold
- Risk scoring with category weights and contextual multipliers; levels LOW/MEDIUM/HIGH/CRITICAL
- Audit stores requestId, persona, riskLevel, categories, actionTaken; PII redacted in content preview
- File upload: MIME/extension allow-list, size limit, store outside web root, Lakera scan on extracted text and on chunks before embedding; HIGH/CRITICAL → quarantine

## Release notes (demo seed and security)

- **Demo finance pipeline**: SQLite at `data/db/app.sqlite` with tables `users`, `accounts`, `transactions`, `chat_events`. Scripts: `pnpm run db:init`, `pnpm run import:finance` (from `data/seed/secure_ai_chat_demo_data_csvs.zip`), `pnpm run rag:rebuild-finance`. With `USE_DEMO_FINANCE_DATA=true`, dashboard and chat use SQLite as single source for balances/transactions when session email matches a demo user.
- **Identity**: `POST /api/auth/verify-last4` verifies SSN last 4 and sets session verified with TTL; chat refuses finance disclosure until verified.
- **RAG**: Per-user finance docs under `data/rag/users/<user_id>/` (profile.md, accounts.md, transactions_12mo.md) indexed into `FinanceRagChunk` with metadata `docType: "finance"`. Retrieval scoped strictly by verified session userId; no cross-user retrieval.
- **Lakera**: `lib/lakera-guard.ts` screens user prompt, retrieved context, and model output; all events logged to SQLite `chat_events`. `GET /api/admin/security-events` (admin-only) returns Lakera blocks/flags with optional filters.
- **Finance Q&A**: Answers computed from DB first (balances, recent tx, totals); tool output injected as trusted context; RAG is supplemental only; LLM does not invent numbers.
