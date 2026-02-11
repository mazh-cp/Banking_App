# Launch Readiness: Comprehensive Test Plan

## 1. Scope

- **Unit tests**: Pure functions (risk scoring, validation, RBAC, redaction).
- **Integration tests**: API routes with DB (auth, chat, profile, admin, file upload).
- **E2E (critical flows)**: Login → Dashboard, Chat with verification, Admin settings, Apply flow.

## 2. Critical User Flows

| ID | Flow | Type | Coverage |
|----|------|------|----------|
| F1 | Anonymous → Login → Dashboard | E2E / Integration | Login API, session, redirect |
| F2 | Customer → Chat (balance/transactions) with SSN last-4 verification | Integration | verify-last4, chat route, tool context |
| F3 | Admin → Settings → Set API key / config | Integration | requireAdmin, config/secret API |
| F4 | Customer → File upload → RAG | Integration | upload, scan, chunk, getRelevantChunks by userId |
| F5 | Customer → Apply (credit card / mortgage / auto) | Integration | apply APIs, readonly blocked |
| F6 | Security: blocked prompt (Lakera), safe-rewrite output | Integration | chat route, CHAT_BLOCKED_LAKERA audit |
| F7 | Ledger integrity: balances and transactions consistency | Unit/Integration | banking-service, demo-db or Prisma |

## 3. Automated Tests (Existing + Added)

- `tests/risk-scoring.test.ts` – risk score computation (unit).
- `tests/verification.test.ts` – SSN last-4, verification status, lockout (integration).
- `tests/upload-scan.test.ts` – file scan behavior (integration).
- `tests/dashboard-chat-correlation.test.ts` – dashboard and chat correlation (integration).
- `tests/admin-403.test.ts` – non-admin cannot access admin API (integration).
- `tests/ai-readiness.test.ts` – maintenance mode / readiness (unit).
- `tests/ledger-integrity.test.ts` – balance/transaction consistency (integration).

## 4. Pass Criteria

- All tests in `tests/*.test.ts` pass.
- `pnpm run build` succeeds.
- No critical or high dependency vulnerabilities (`pnpm audit --audit-level=high`).
- Secret scan (gitleaks) and SAST (semgrep) clean or accepted exceptions documented.

## 5. Running Tests

```bash
pnpm run test
# Or individually:
pnpm exec tsx tests/risk-scoring.test.ts
pnpm exec tsx tests/verification.test.ts
pnpm exec tsx tests/ledger-integrity.test.ts
./scripts/release-gate.sh
```
