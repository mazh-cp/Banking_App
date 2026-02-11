# Lakera AI Guard Enforcement

## Overview

Lakera Guard is enforced on:

1. **Chat input** – Every user prompt is screened via `/v2/guard` before tools or the LLM run.
2. **Retrieved RAG context** – When RAG is used, retrieved chunks are screened; if flagged, context is cleared before being sent to the model.
3. **Model output** – Assistant response is screened; if flagged above threshold, the response is replaced with a safe refusal message.

## Safe Refusal Behavior

- **Input blocked**: Request is not sent to the model. User sees a block message; event `CHAT_BLOCKED_LAKERA` is recorded.
- **Output safe-rewrite**: Model response is replaced with: *"I'm sorry, I can't provide that response. Please ask about your accounts or our products (credit cards, mortgages, auto loans)."*

## Admin-Visible Security Events

Admins can view:

- **Admin → Security Warnings**: Events for `CHAT_BLOCKED_LAKERA`, `CHAT_IDENTITY_FAILED`, `CHAT_IDENTITY_REQUIRED`, with optional link to Lakera evidence.
- **Admin → Activity**: Logins, chat requests, tool calls, file uploads.
- **Admin → Audit**: Full audit trail; filter by event type (e.g. `CHAT_BLOCKED_LAKERA`).

Lakera evidence (guard/results) is stored in `LakeraEvidence` and linked to `AuditEvent` for blocked requests.

## Configuration

- **Enable/disable input or output validation**: Admin → Settings → Lakera AI validation (Input validation / Output validation toggles).
- **Project policy**: `LAKERA_PROJECT_ID` (env or Admin Settings) defines the Guard policy used for screening.
