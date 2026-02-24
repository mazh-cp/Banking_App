# Changelog

All notable changes to the FinGuard Banking App are documented here.

## [1.0.0] - Production release

### Banking flows

- **Dashboard**: Account balances (checking, savings, credit card), recent transactions, and account list with status.
- **Transactions**: Full transaction history with type, description, and amount; tenant-scoped by authenticated user.
- **Transfers**: In-chat transfer flow with propose → confirm (YES/NO) → execute; amounts and balances sourced from trusted banking tools only.
- **Applications**: Apply for credit card, auto loan, and mortgage; form validation and status tracking; readonly accounts cannot submit.
- **Identity verification**: Optional SSN last-4 (hashed at rest) for account-specific chat; verification required before balance/transfer tools run.
- **Profile**: Update name and optional SSN last-4; secure storage and audit of verification attempts.

### Lakera security integration

- **Lakera Guard v2**: All chat user input is screened via `https://api.lakera.ai/v2/guard` before tools or the LLM run; no `/guard/results` in runtime (calibration only).
- **Input screening**: Prompt injection, jailbreak, system prompt extraction, data exfiltration, tool abuse, and fraud intent are blocked or masked; configurable block/safe-rewrite thresholds.
- **Tool-argument screening**: Banking tool arguments (e.g. transfer amount, account) are screened before execution.
- **Output screening**: Holistic LLM output screening (conversation context, tool args, tool output, RAG) before response is returned; flagged output is replaced with a safe message.
- **Defense-in-depth**: App-layer block list for obvious jailbreak/cross-user phrases when Security Mode is on; safe-rewrite always replaces response content when flagged.
- **Configuration**: `LAKERA_MODE` (enforce/monitor/off), `LAKERA_FAIL_OPEN`, `LAKERA_API_BASE`, `LAKERA_GUARD_API_KEY` / `LAKERA_API_KEY`, `LAKERA_PROJECT_ID`; keys can be stored in Admin Settings (encrypted).

### Admin panel

- **Activity**: Global activity summary (logins, chat requests, tool calls, file uploads) with date range; top users by chat volume.
- **Risk map**: Chat misuse metrics by risk level (LOW/MEDIUM/HIGH/CRITICAL), blocked/safe-rewrite counts, category breakdown, file scan risk.
- **Security warnings**: Blocked prompts and safe-rewrite events; drill-down to Lakera evidence when stored.
- **Audit**: Chat and audit event log with filters (risk level, persona, category, date); action taken (blocked, safe_rewrite, allowed).
- **Compliance**: Compliance dashboard with control-to-feature traceability and runtime evidence; blocked/safe-rewrite percentages.
- **Settings**: Encrypted storage for OpenAI, Anthropic, and Lakera API keys; connection tests for each; config for Lakera project ID and validation toggles.
- **Accounts**: List accounts/balances across users; top-up funds for demo; audit of admin actions.
- **Dashboard (admin)**: Colorful overview of findings/flags (blocked, safe rewrite, risk levels), top users by blocks/rewrites/high risk, and recent malicious/flagged activity.

### Infrastructure & config

- **Secrets**: No API keys or secrets hardcoded; keys from Admin Secret Store or environment variables; `.env` in `.gitignore`; `.env.example` documents required variables.
- **Logging**: Balance mismatch and security-related warnings use secure logger (redacted); no debug logs in production paths.
- **Version**: Application version set to 1.0.0 in `package.json`.
