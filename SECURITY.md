# Security Policy

## Supported Versions

Security updates are applied to the current main line. Use the latest tagged release for production.

## Reporting a Vulnerability

- **Do not** open a public GitHub issue for vulnerabilities.
- Email security concerns to your designated security contact or repository maintainer.
- Include steps to reproduce and impact. We will respond and coordinate disclosure.

## Security Practices in This App

- **Authentication**: Session-based auth with httpOnly cookies; CSRF protection on state-changing requests.
- **Authorization**: Server-side RBAC; admin routes use `requireAdmin()`; customer data scoped by `userId`.
- **Secrets**: API keys stored encrypted at rest when `SECRETS_ENCRYPTION_KEY` is set; never logged or sent to the client.
- **Input**: Request body size limits, chat message length limits, and Lakera Guard on chat input and output.
- **Rate limiting**: In-memory (or Redis) rate limit per user; configurable via `RATE_LIMIT_REQUESTS_PER_MINUTE`.
- **Audit**: Login, chat blocks, verification failures, and admin actions are recorded in the audit trail.
- **PII**: SSN last 4 is hashed only; secure logging redacts PII and secrets.

## Release and AppSec

- Before release, run `./scripts/release-gate.sh` (lint, build, tests, dependency audit, secret scan, SAST).
- Fix or document any failing steps. See `docs/launch-readiness-checklist.md` for pass/fail criteria.
