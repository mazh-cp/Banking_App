# FinGuard Bank Simulator – Admin Guide

## Access

- Sign in with an **admin** account (e.g. `admin@finguard.demo`).
- Use the **Admin** menu for Settings, Activity, Security Warnings, Audit, Compliance, Risk Map, Demo.

## Admin → Settings

- **API keys**: Set OpenAI, Anthropic, and Lakera API keys (stored encrypted when `SECRETS_ENCRYPTION_KEY` is set).
- **Lakera Project ID**: Required for Guard policy.
- **Lakera AI validation**: Enable/disable **input** and **output** validation for chat.
- **Test**: Verify API connectivity for each key.

## Admin → Activity

- View **logins**, **chat requests**, **tool calls**, **file uploads** over 24h / 7d / 30d.
- **Top users by chat activity** and **events by type**.

## Admin → Security Warnings

- **Blocked chat** (Lakera), **identity verification failures**, **verification required** events.
- Drill into an event to see **Lakera evidence** (guard/results) when available.

## Admin → Audit

- Full **audit trail** with filters (event type, date, user).
- Use for compliance and incident review.

## Admin Dashboard Widgets (Dashboard when logged in as admin)

- **Active users**: Users with an active session.
- **Logins (past 7 days)**: Distinct users who logged in.
- **Users flagged for security**: Distinct users with at least one chat block (Lakera).

## Security and Compliance

- All admin actions are logged. API keys are never returned to the client.
- See **LAKERA_GUARD_ENFORCEMENT.md** for how input, RAG context, and output are screened and where events appear.
