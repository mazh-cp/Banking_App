# Launch Readiness Checklist

Use this checklist before release. **Do not push to a public remote** from the `launch-readiness` branch until all criteria are met and you have run the release gate.

---

## 1. Tests

| Criterion | Pass | Fail | Notes |
|-----------|------|------|--------|
| All unit/integration tests pass (`pnpm run test` or `tsx tests/*.test.ts`) | ☐ | ☐ | Include risk-scoring, verification, ledger-integrity, admin-403 |
| Build succeeds (`pnpm run build`) | ☐ | ☐ | |
| Lint passes (`pnpm run lint`) | ☐ | ☐ | |

---

## 2. Security Hardening

| Criterion | Pass | Fail | Notes |
|-----------|------|------|--------|
| Server-side authZ on all protected routes (requireSession / requireAdmin) | ☐ | ☐ | Admin APIs use requireAdmin; app layout redirects unauthenticated |
| Tenant isolation: data scoped by userId (RAG, balances, transactions) | ☐ | ☐ | getRelevantChunks, getBalances, etc. take userId |
| RBAC: readonly cannot submit applications or upload files | ☐ | ☐ | Enforced in apply/upload APIs |
| Secure sessions (httpOnly cookie, SESSION_SECRET set) | ☐ | ☐ | |
| Input validation and body size limits (middleware + route-level) | ☐ | ☐ | MAX_REQUEST_BODY_BYTES, MAX_CHAT_MESSAGE_LENGTH |
| Rate limiting enabled (RATE_LIMIT_REQUESTS_PER_MINUTE) | ☐ | ☐ | checkRateLimit in chat and admin |
| Secure logging (no raw secrets/PII in logs); audit logs for sensitive actions | ☐ | ☐ | secure-logger.ts; AuditEvent / ChatAudit |

---

## 3. AppSec Checks

| Criterion | Pass | Fail | Notes |
|-----------|------|------|--------|
| Dependency scan: `./scripts/security/deps-audit.sh` (no high/critical) | ☐ | ☐ | Or set AUDIT_LEVEL=critical |
| Secret scan: `./scripts/security/secret-scan.sh` (no leaks) | ☐ | ☐ | Requires gitleaks; skip if not installed |
| SAST: `./scripts/security/sast.sh` (no ERROR findings) | ☐ | ☐ | Requires semgrep; skip if not installed |
| Release gate: `./scripts/release-gate.sh` exits 0 | ☐ | ☐ | Full pipeline |

---

## 4. Lakera AI Guard

| Criterion | Pass | Fail | Notes |
|-----------|------|------|--------|
| Chat input screened (Lakera Guard); blocked requests not sent to model | ☐ | ☐ | screenPrompt in chat route |
| RAG context screened; flagged context cleared before use | ☐ | ☐ | screenContext in chat route |
| Model output screened; safe refusal on flagged output | ☐ | ☐ | screenOutput + safe_rewrite |
| Admin-visible security events (Security Warnings, Audit) | ☐ | ☐ | CHAT_BLOCKED_LAKERA, evidence |

---

## 5. Production Readiness

| Criterion | Pass | Fail | Notes |
|-----------|------|------|--------|
| Strict env config loader; required vars in production | ☐ | ☐ | src/lib/config/env.ts |
| Error handling: no stack traces or secrets to client | ☐ | ☐ | Generic messages in API responses |
| Idempotency for money-like actions (applications, tool use) | ☐ | ☐ | Apply APIs create with upsert/unique refs; document in OPERATIONS.md if needed |
| Ledger integrity tests (balances/transactions consistency) | ☐ | ☐ | tests/ledger-integrity.test.ts |

---

## 6. Documentation

| Criterion | Pass | Fail | Notes |
|-----------|------|------|--------|
| End-user guide (docs/END_USER_GUIDE.md) | ☐ | ☐ | |
| Admin guide (docs/ADMIN_GUIDE.md) | ☐ | ☐ | |
| DevOps guide (docs/DEVOPS_GUIDE.md) | ☐ | ☐ | |
| SECURITY.md (reporting, practices) | ☐ | ☐ | |
| .env.example present and documented | ☐ | ☐ | |
| Launch readiness checklist (this file) | ☐ | ☐ | |

---

## 7. Repo Hygiene

| Criterion | Pass | Fail | Notes |
|-----------|------|------|--------|
| .gitignore excludes .env, node_modules, secrets, build artifacts | ☐ | ☐ | |
| No secrets or API keys committed | ☐ | ☐ | Run secret-scan |
| No push to public remote from launch-readiness until checklist complete | ☐ | ☐ | |

---

## Final Summary

- **Pass**: All rows above marked Pass (or explicitly accepted with documented exceptions).
- **Fail**: Any critical row marked Fail must be fixed before release.

Run the full release gate and capture output:

```bash
./scripts/release-gate.sh
```

## Run Release Gate

```bash
CI=true ./scripts/release-gate.sh
# If gitleaks/semgrep not installed:
CI=true ./scripts/release-gate.sh --skip-appsec
```

**Pass**: Gate exits 0; all checklist sections above can be marked Pass (or documented exceptions).  
**Fail**: Any critical criterion marked Fail must be fixed before release. Do **not** push to a public remote until the checklist is complete.

**Date completed**: _______________  
**Signed off**: _______________
