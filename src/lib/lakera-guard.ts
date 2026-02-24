/**
 * Legacy adapter: all Lakera screening routes through lib/security/lakera-guard.
 * Re-exports the single gateway and provides GuardV2Result-shaped APIs for backward compatibility.
 */

import {
  screenText,
  screenMessages,
  severityFromReasonCodes,
} from '@/lib/security/lakera-guard';
import { logChatEvent } from '@/lib/sqlite-db';
import type { NormalizedCategory } from '@/lib/security/lakera-normalize';

export type GuardV2Result = {
  flagged: boolean;
  requestId?: string;
  categories: Record<string, boolean>;
  normalizedCategories: NormalizedCategory[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  raw: unknown;
};

function decisionToGuardResult(decision: { action: string; reasonCodes: string[]; raw?: Record<string, unknown> }): GuardV2Result {
  const requestId = (decision.raw as { request_uuid?: string })?.request_uuid;
  return {
    flagged: decision.action === 'block',
    requestId,
    categories: decision.reasonCodes.reduce((acc, c) => ({ ...acc, [c]: true }), {} as Record<string, boolean>),
    normalizedCategories: decision.reasonCodes as NormalizedCategory[],
    severity: severityFromReasonCodes(decision.reasonCodes),
    raw: decision.raw ?? {},
  };
}

/** Screen user prompt. Routes through lib/security/lakera-guard. */
export async function screenPrompt(
  text: string,
  options: ScreenOptions & { context?: string }
): Promise<GuardV2Result> {
  const correlationId = options.requestId ?? `legacy-${Date.now()}`;
  const decision = await screenMessages({
    stage: 'USER_INPUT',
    messages: options.context ? [{ role: 'user', content: `Context: ${options.context}` }, { role: 'user', content: text }] : [{ role: 'user', content: text }],
    userId: options.userId ?? undefined,
    sessionId: options.userId ?? undefined,
    correlationId,
    apiKey: options.apiKey,
    projectId: options.projectId,
  });
  logChatEvent({
    userId: options.userId ?? null,
    requestId: options.requestId ?? null,
    eventType: 'LAKERA_PROMPT',
    labels: JSON.stringify(decision.reasonCodes),
    action: decision.action === 'block' ? 'blocked' : 'allowed',
  });
  return decisionToGuardResult(decision);
}

/** Screen retrieved RAG context. Routes through lib/security/lakera-guard. */
export async function screenContext(text: string, options: ScreenOptions): Promise<GuardV2Result> {
  const correlationId = options.requestId ?? `legacy-${Date.now()}`;
  const decision = await screenText({
    stage: 'RAG_CONTEXT',
    text,
    userId: options.userId ?? undefined,
    sessionId: options.userId ?? undefined,
    correlationId,
    apiKey: options.apiKey,
    projectId: options.projectId,
  });
  logChatEvent({
    userId: options.userId ?? null,
    requestId: options.requestId ?? null,
    eventType: 'LAKERA_CONTEXT',
    labels: JSON.stringify(decision.reasonCodes),
    action: decision.action === 'block' ? 'blocked' : 'allowed',
  });
  return decisionToGuardResult(decision);
}

/** Screen model output. Routes through lib/security/lakera-guard. */
export async function screenOutput(text: string, options: ScreenOptions): Promise<GuardV2Result> {
  const correlationId = options.requestId ?? `legacy-${Date.now()}`;
  const decision = await screenText({
    stage: 'LLM_OUTPUT',
    text,
    userId: options.userId ?? undefined,
    sessionId: options.userId ?? undefined,
    correlationId,
    apiKey: options.apiKey,
    projectId: options.projectId,
  });
  logChatEvent({
    userId: options.userId ?? null,
    requestId: options.requestId ?? null,
    eventType: 'LAKERA_OUTPUT',
    labels: JSON.stringify(decision.reasonCodes),
    action: decision.action === 'block' ? 'blocked' : 'allowed',
  });
  return decisionToGuardResult(decision);
}

export type ScreenOptions = {
  userId?: string | null;
  requestId?: string | null;
  persona?: string;
  apiKey?: string | null;
  projectId?: string | null;
};
