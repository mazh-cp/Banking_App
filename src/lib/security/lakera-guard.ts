/**
 * Single source of truth: Lakera Guard "always-on" security gateway.
 * Screens USER_INPUT, RAG_CONTEXT, TOOL_ARGS, LLM_OUTPUT.
 * All Lakera API calls go through this module only.
 */

import { lakeraConfig, LAKERA_ENABLED } from './lakera-config';
import type { LakeraDecision, LakeraStage, LakeraAction } from './lakera-types';
import { redactForAuditPreview } from './redact';

// ----- URL / domain helpers (used for unknown links) -----

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export function extractUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(URL_REGEX);
  return matches ? Array.from(new Set(matches)) : [];
}

export function domainFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function unknownLinkDomains(text: string, allowedDomains: string[]): string[] {
  const urls = extractUrls(text);
  const allowed = new Set(allowedDomains.map((d) => d.toLowerCase()));
  const unknown: string[] = [];
  for (const url of urls) {
    const domain = domainFromUrl(url);
    if (domain && !allowed.has(domain)) unknown.push(domain);
  }
  return Array.from(new Set(unknown));
}

// ----- Guard API (internal) -----

type GuardPayload = {
  messages: { role: string; content: string }[];
  project_id?: string;
  breakdown?: boolean;
  metadata?: Record<string, string>;
};

type GuardResponse = {
  flagged?: boolean;
  metadata?: { request_uuid?: string };
  breakdown?: Array<{
    detector_type?: string;
    detected?: boolean;
    flagged?: boolean;
    risk_score?: number;
  }>;
  categories?: Record<string, boolean>;
  [k: string]: unknown;
};

const LAKERA_RETRY_ATTEMPTS = 2;
const LAKERA_RETRY_DELAYS_MS = [500, 1000];

async function callGuard(
  body: GuardPayload,
  apiKey: string,
  baseUrl: string
): Promise<{ data?: GuardResponse; error?: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/guard`;
  let lastError: string | undefined;
  for (let attempt = 0; attempt <= LAKERA_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        lastError = `Guard ${res.status}: ${text.slice(0, 200)}`;
        if (res.status >= 500 && attempt < LAKERA_RETRY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, LAKERA_RETRY_DELAYS_MS[attempt]));
          continue;
        }
        return { error: lastError };
      }
      const data = (await res.json()) as GuardResponse;
      return { data };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt < LAKERA_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, LAKERA_RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return { error: lastError };
    }
  }
  return { error: lastError ?? 'Unknown Lakera error' };
}

function severityFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

/** Map Lakera breakdown to reason codes (no raw PII). */
function reasonCodesFromResponse(data: GuardResponse): string[] {
  const codes: string[] = [];
  const breakdown = data.breakdown;
  if (Array.isArray(breakdown)) {
    for (const b of breakdown) {
      if (b.detected === true || b.flagged === true) {
        const t = (b.detector_type ?? '').toLowerCase().replace(/\s+/g, '_');
        if (t) codes.push(t);
      }
    }
  }
  if (data.categories && typeof data.categories === 'object') {
    for (const [k, v] of Object.entries(data.categories)) {
      if (v) codes.push(k.toLowerCase().replace(/\s+/g, '_'));
    }
  }
  return Array.from(new Set(codes));
}

/** Strip URLs from text (for mask when unknown_links). */
function stripUrls(text: string): string {
  return text.replace(URL_REGEX, '[link removed]').trim();
}

// ----- Public screening API -----

export type ScreenTextParams = {
  stage: LakeraStage;
  text: string;
  userId?: string | null;
  sessionId?: string | null;
  correlationId: string;
  apiKey?: string | null;
  projectId?: string | null;
};

export type ScreenMessagesParams = {
  stage: LakeraStage;
  messages: { role: string; content: string }[];
  userId?: string | null;
  sessionId?: string | null;
  correlationId: string;
  apiKey?: string | null;
  projectId?: string | null;
};

/** Screen a single text (RAG chunk, TOOL_ARGS, LLM output). */
export async function screenText(params: ScreenTextParams): Promise<LakeraDecision> {
  const { stage, text, userId, sessionId, correlationId, apiKey: overrideKey, projectId: overrideProjectId } = params;
  // When the chat route (or other caller) passes apiKey/projectId, they override env (e.g. Admin-stored keys).
  const apiKey = overrideKey ?? lakeraConfig.apiKey;
  const projectId = overrideProjectId ?? lakeraConfig.projectId;

  const decision: LakeraDecision = {
    action: 'allow',
    reasonCodes: [],
    correlationId,
    projectId: projectId || undefined,
  };

  if (lakeraConfig.mode === 'off') {
    decision.reasonCodes = ['lakera_off'];
    return decision;
  }

  const unknownDomains = unknownLinkDomains(text, lakeraConfig.allowedDomains);
  if (unknownDomains.length > 0) {
    decision.reasonCodes.push('unknown_links');
  }

  if (!apiKey) {
    if (lakeraConfig.failOpen) {
      decision.reasonCodes.push('lakera_unavailable');
      return decision;
    }
    decision.action = stage === 'LLM_OUTPUT' ? 'mask' : 'block';
    decision.reasonCodes.push('lakera_unavailable');
    decision.redactedText = stage === 'LLM_OUTPUT' ? "I'm sorry, I can't provide that response. Please ask about your accounts or our products." : undefined;
    decision.raw = { skipped: 'no_api_key' };
    return decision;
  }

  const messages: { role: string; content: string }[] = [];
  if (stage === 'RAG_CONTEXT') messages.push({ role: 'user', content: `Context: ${text.slice(0, 8000)}` });
  else if (stage === 'LLM_OUTPUT') {
    messages.push({ role: 'user', content: '(user message)' });
    messages.push({ role: 'assistant', content: text.slice(0, 32000) });
  } else {
    messages.push({ role: 'user', content: text.slice(0, 32000) });
    messages.push({ role: 'assistant', content: '' });
  }

  const body: GuardPayload = {
    messages,
    breakdown: true,
  };
  if (projectId) body.project_id = projectId;
  if (userId || sessionId) {
    body.metadata = {};
    if (userId) body.metadata.user_id = userId;
    if (sessionId) body.metadata.session_id = sessionId;
  }

  const baseUrl = lakeraConfig.baseUrl;
  const { data, error } = await callGuard(body, apiKey!, baseUrl);

  if (error || !data) {
    if (lakeraConfig.failOpen) {
      decision.reasonCodes.push('lakera_unavailable');
      return decision;
    }
    decision.action = stage === 'LLM_OUTPUT' ? 'mask' : stage === 'RAG_CONTEXT' ? 'block' : 'block';
    decision.reasonCodes.push('lakera_unavailable');
    decision.redactedText = stage === 'LLM_OUTPUT' ? "I'm sorry, I can't provide that response. Please try again or ask about your accounts." : undefined;
    decision.raw = { error: (error ?? 'unknown').slice(0, 100) };
    return decision;
  }

  const reasonCodes = reasonCodesFromResponse(data);
  decision.reasonCodes = Array.from(new Set([...decision.reasonCodes, ...reasonCodes]));
  decision.raw = {
    request_uuid: data.metadata?.request_uuid,
    flagged: data.flagged,
  };

  let action: LakeraAction = 'allow';
  if (data.flagged) {
    action = 'block';
    if (data.breakdown?.some((b) => (b.detector_type ?? '').toLowerCase().includes('pii') || (b.detector_type ?? '').toLowerCase().includes('redact'))) {
      action = 'mask';
    }
  }
  if (unknownDomains.length > 0 && lakeraConfig.mode === 'enforce') {
    action = stage === 'LLM_OUTPUT' || stage === 'USER_INPUT' ? 'mask' : action;
    if (action === 'mask') decision.redactedText = stripUrls(text).slice(0, 32000) || '(content not shown)';
  }
  if (action === 'mask' && !decision.redactedText && data.flagged) {
    decision.redactedText = redactForAuditPreview(text, 500).slice(0, 2000) || '(redacted)';
  }

  if (lakeraConfig.mode === 'monitor') {
    if (action === 'block') {
      decision.wouldHaveBeenBlocked = true;
      action = 'allow';
    }
  }

  decision.action = action;
  return decision;
}

/** Screen conversation messages (USER_INPUT). */
export async function screenMessages(params: ScreenMessagesParams): Promise<LakeraDecision> {
  const { messages, userId, sessionId, correlationId, apiKey: overrideKey, projectId: overrideProjectId } = params;
  // overrideKey/overrideProjectId override env when provided (e.g. Admin-stored keys from chat route).
  const apiKey = overrideKey ?? lakeraConfig.apiKey;
  const projectId = overrideProjectId ?? lakeraConfig.projectId;

  const decision: LakeraDecision = {
    action: 'allow',
    reasonCodes: [],
    correlationId,
    projectId: projectId || undefined,
  };

  if (lakeraConfig.mode === 'off') {
    decision.reasonCodes = ['lakera_off'];
    return decision;
  }

  const combinedText = messages.map((m) => m.content).join('\n');
  const unknownDomains = unknownLinkDomains(combinedText, lakeraConfig.allowedDomains);
  if (unknownDomains.length > 0) decision.reasonCodes.push('unknown_links');

  if (!apiKey) {
    if (lakeraConfig.failOpen) {
      decision.reasonCodes.push('lakera_unavailable');
      return decision;
    }
    decision.action = 'block';
    decision.reasonCodes.push('lakera_unavailable');
    decision.raw = { skipped: 'no_api_key' };
    return decision;
  }

  const guardMessages = messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 8000),
  }));
  if (guardMessages.length === 0) guardMessages.push({ role: 'user', content: '' });
  const lastIsUser = guardMessages[guardMessages.length - 1]?.role === 'user';
  if (lastIsUser) guardMessages.push({ role: 'assistant', content: '' });

  const body: GuardPayload = {
    messages: guardMessages,
    breakdown: true,
  };
  if (projectId) body.project_id = projectId;
  if (userId || sessionId) {
    body.metadata = {};
    if (userId) body.metadata.user_id = userId;
    if (sessionId) body.metadata.session_id = sessionId;
  }

  const { data, error } = await callGuard(body, apiKey, lakeraConfig.baseUrl);

  if (error || !data) {
    if (lakeraConfig.failOpen) {
      decision.reasonCodes.push('lakera_unavailable');
      return decision;
    }
    decision.action = 'block';
    decision.reasonCodes.push('lakera_unavailable');
    decision.raw = { error: (error ?? 'unknown').slice(0, 100) };
    return decision;
  }

  const reasonCodes = reasonCodesFromResponse(data);
  decision.reasonCodes = Array.from(new Set([...decision.reasonCodes, ...reasonCodes]));
  decision.raw = { request_uuid: data.metadata?.request_uuid, flagged: data.flagged };

  let action: LakeraAction = 'allow';
  if (data.flagged) {
    action = 'block';
    if (data.breakdown?.some((b) => (b.detector_type ?? '').toLowerCase().includes('pii'))) action = 'mask';
  }
  if (unknownDomains.length > 0 && lakeraConfig.mode === 'enforce') {
    action = 'mask';
    const lastUserContent = messages.filter((m) => m.role === 'user').pop()?.content ?? combinedText;
    decision.redactedText = stripUrls(lastUserContent).slice(0, 32000) || '';
  }
  if (action === 'mask' && !decision.redactedText && data.flagged) {
    decision.redactedText = redactForAuditPreview(combinedText, 500).slice(0, 2000) || '(redacted)';
  }
  if (lakeraConfig.mode === 'monitor' && action === 'block') {
    decision.wouldHaveBeenBlocked = true;
    action = 'allow';
  }
  decision.action = action;
  return decision;
}

/**
 * Fetch /guard/results by request_id. NOT used in runtime path.
 * Use only in calibration/evaluation scripts (see scripts/lakera-calibration.ts).
 */
export async function fetchGuardResultsForCalibration(
  requestId: string,
  apiKey?: string | null
): Promise<unknown> {
  const key = apiKey ?? lakeraConfig.apiKey;
  if (!key) return null;
  try {
    const url = `${lakeraConfig.baseUrl.replace(/\/$/, '')}/guard/results?request_id=${encodeURIComponent(requestId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

/** Derive severity from reason codes for audit/risk. */
export function severityFromReasonCodes(reasonCodes: string[]): 'low' | 'medium' | 'high' | 'critical' {
  const high = ['prompt_injection', 'data_exfiltration', 'jailbreak', 'system_prompt_extraction', 'tool_abuse', 'fraud'];
  const med = ['unknown_links', 'pii', 'lakera_unavailable'];
  for (const c of reasonCodes) {
    if (high.some((h) => c.toLowerCase().includes(h))) return 'high';
    if (med.some((m) => c.toLowerCase().includes(m))) return 'medium';
  }
  return reasonCodes.length > 0 ? 'medium' : 'low';
}

export type ScreenOutputHolisticParams = {
  assistantContent: string;
  conversationSummary?: string;
  toolArgsSummary?: string;
  toolOutputSummary?: string;
  ragContent?: string;
  userId?: string | null;
  correlationId: string;
  apiKey?: string | null;
  projectId?: string | null;
};

/**
 * Holistic screening of assistant output before returning to client.
 * Sends conversation context, tool args summary, tool output summary, and RAG content so Guard can make a runtime decision with full context.
 */
export async function screenOutputHolistic(params: ScreenOutputHolisticParams): Promise<LakeraDecision> {
  const {
    assistantContent,
    conversationSummary = '',
    toolArgsSummary = '',
    toolOutputSummary = '',
    ragContent = '',
    userId,
    correlationId,
    apiKey: overrideKey,
    projectId: overrideProjectId,
  } = params;
  const apiKey = overrideKey ?? lakeraConfig.apiKey;
  const projectId = overrideProjectId ?? lakeraConfig.projectId;
  const decision: LakeraDecision = {
    action: 'allow',
    reasonCodes: [],
    correlationId,
    projectId: projectId || undefined,
  };
  if (lakeraConfig.mode === 'off') {
    decision.reasonCodes = ['lakera_off'];
    return decision;
  }
  if (!apiKey) {
    if (lakeraConfig.failOpen) {
      decision.reasonCodes.push('lakera_unavailable');
      return decision;
    }
    decision.action = 'mask';
    decision.reasonCodes.push('lakera_unavailable');
    decision.redactedText = "I'm sorry, I can't provide that response. Please try again.";
    return decision;
  }
  const contextParts: string[] = [];
  if (conversationSummary) contextParts.push(`Conversation context:\n${conversationSummary.slice(0, 4000)}`);
  if (toolArgsSummary) contextParts.push(`Tool args summary:\n${toolArgsSummary.slice(0, 2000)}`);
  if (toolOutputSummary) contextParts.push(`Tool output summary:\n${toolOutputSummary.slice(0, 6000)}`);
  if (ragContent) contextParts.push(`RAG content:\n${ragContent.slice(0, 4000)}`);
  const userContext = contextParts.length ? contextParts.join('\n\n') : '(no additional context)';
  const messages: { role: string; content: string }[] = [
    { role: 'user', content: userContext },
    { role: 'assistant', content: assistantContent.slice(0, 32000) },
  ];
  const body: GuardPayload = {
    messages,
    breakdown: true,
  };
  if (projectId) body.project_id = projectId;
  if (userId) body.metadata = { user_id: userId };
  const { data, error } = await callGuard(body, apiKey, lakeraConfig.baseUrl);
  if (error || !data) {
    if (lakeraConfig.failOpen) {
      decision.reasonCodes.push('lakera_unavailable');
      return decision;
    }
    decision.action = 'mask';
    decision.reasonCodes.push('lakera_unavailable');
    decision.redactedText = "I'm sorry, I can't provide that response. Please try again.";
    decision.raw = { error: (error ?? 'unknown').slice(0, 100) };
    return decision;
  }
  const reasonCodes = reasonCodesFromResponse(data);
  decision.reasonCodes = reasonCodes;
  decision.raw = { request_uuid: data.metadata?.request_uuid, flagged: data.flagged };
  let action: LakeraAction = 'allow';
  if (data.flagged) {
    action = 'block';
    if (data.breakdown?.some((b) => (b.detector_type ?? '').toLowerCase().includes('pii') || (b.detector_type ?? '').toLowerCase().includes('redact'))) {
      action = 'mask';
    }
  }
  if (lakeraConfig.mode === 'monitor' && action === 'block') {
    decision.wouldHaveBeenBlocked = true;
    action = 'allow';
  }
  decision.action = action;
  if (action === 'mask' && data.flagged && !decision.redactedText) {
    decision.redactedText = redactForAuditPreview(assistantContent, 500).slice(0, 2000) || '(redacted)';
  }
  return decision;
}

/**
 * Screen a user/assistant interaction (conversation). Uses /v2/guard with metadata.
 * API key from env (LAKERA_GUARD_API_KEY / LAKERA_API_KEY). Server-only.
 */
export async function screenInteraction(params: ScreenMessagesParams): Promise<LakeraDecision> {
  return screenMessages({ ...params, stage: 'USER_INPUT' });
}

/**
 * Screen serialized tool arguments before execution. Uses /v2/guard with metadata.
 * API key from env. Server-only. Call before executing transfer/credit actions.
 */
export async function screenToolArgs(params: Omit<ScreenTextParams, 'stage'>): Promise<LakeraDecision> {
  return screenText({ ...params, stage: 'TOOL_ARGS' });
}

// Re-export for consumers that need stage/types
export type { LakeraDecision, LakeraStage, LakeraAction };
export { LAKERA_ENABLED, lakeraConfig };
