/**
 * Lakera Guard v2 wrapper: screen (a) user prompt, (b) retrieved context, (c) model output.
 * Log all events to SQLite chat_events. If any screen says block, caller should refuse safely.
 */

import { guardText } from '@/lib/security/lakera-v2';
import { logChatEvent } from '@/lib/sqlite-db';
import type { GuardV2Result } from '@/lib/security/lakera-v2';

export type ScreenOptions = {
  userId?: string | null;
  requestId?: string | null;
  persona?: string;
  apiKey?: string | null;
  projectId?: string | null;
};

async function screen(
  text: string,
  mode: 'input' | 'output',
  eventType: string,
  options: ScreenOptions & { context?: string }
): Promise<GuardV2Result> {
  const result = await guardText({
    text,
    userId: options.userId ?? undefined,
    route: '/api/chat',
    persona: options.persona,
    mode,
    context: options.context,
    apiKey: options.apiKey,
    projectId: options.projectId,
  });

  const action = result.flagged ? 'blocked' : 'allowed';
  logChatEvent({
    userId: options.userId ?? null,
    requestId: options.requestId ?? null,
    eventType,
    labels: JSON.stringify(result.normalizedCategories),
    action,
  });

  return result;
}

/** Screen user prompt. Logs to chat_events. */
export async function screenPrompt(
  text: string,
  options: ScreenOptions & { context?: string }
): Promise<GuardV2Result> {
  return screen(text, 'input', 'LAKERA_PROMPT', options);
}

/** Screen retrieved RAG context. Logs to chat_events. */
export async function screenContext(
  text: string,
  options: ScreenOptions
): Promise<GuardV2Result> {
  return screen(text, 'input', 'LAKERA_CONTEXT', options);
}

/** Screen model output. Logs to chat_events. */
export async function screenOutput(
  text: string,
  options: ScreenOptions
): Promise<GuardV2Result> {
  return screen(text, 'output', 'LAKERA_OUTPUT', options);
}
