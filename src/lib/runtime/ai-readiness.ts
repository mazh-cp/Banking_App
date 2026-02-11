/**
 * AI readiness: single source of truth for whether chat can call LLMs.
 * Server-only; keys from Admin Secret Store (decrypt) or env fallback.
 * Used to enforce maintenance mode when required keys are missing.
 */

import { getSecret, getConfig } from '@/lib/admin/secrets-store';

export type AiReadinessContext = {
  provider: 'openai' | 'anthropic';
  /** When true, Lakera key + LAKERA_PROJECT_ID are required (security scanning enabled). */
  lakeraEnabled: boolean;
  /** When true, Lakera is required even if securityMode is off (policy mandate). */
  requireLakeraAlways?: boolean;
};

export type RuntimeConfig = {
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  lakeraApiKey: string | null;
  lakeraProjectId: string | null;
};

export type AssertAiReadyResult = {
  ready: boolean;
  reason: string;
  missing: string[];
};

const KEY_LABELS: Record<string, string> = {
  OPENAI_API_KEY: 'OpenAI key',
  ANTHROPIC_API_KEY: 'Anthropic key',
  LAKERA_API_KEY: 'Lakera key',
  LAKERA_PROJECT_ID: 'Lakera Project ID',
};

/** Fetches keys from Admin Secret Store (decrypt) and/or env fallback. Server-only. */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const [openaiApiKey, anthropicApiKey, lakeraApiKey, lakeraProjectId] = await Promise.all([
    getSecret('OPENAI_API_KEY'),
    getSecret('ANTHROPIC_API_KEY'),
    getSecret('LAKERA_API_KEY'),
    getConfig('LAKERA_PROJECT_ID'),
  ]);
  return {
    openaiApiKey,
    anthropicApiKey,
    lakeraApiKey,
    lakeraProjectId,
  };
}

/**
 * Pure check given a runtime config. Used by assertAiReady and by tests.
 */
export function checkAiReadyFromConfig(
  config: RuntimeConfig,
  context: AiReadinessContext
): AssertAiReadyResult {
  const missing: string[] = [];

  if (context.provider === 'openai') {
    if (!config.openaiApiKey?.trim()) missing.push('OPENAI_API_KEY');
  } else {
    if (!config.anthropicApiKey?.trim()) missing.push('ANTHROPIC_API_KEY');
  }

  // Lakera v1 guard only needs API key; LAKERA_PROJECT_ID is for v2 (optional for chat)
  const lakeraRequired = context.lakeraEnabled || context.requireLakeraAlways === true;
  if (lakeraRequired) {
    if (!config.lakeraApiKey?.trim()) missing.push('LAKERA_API_KEY');
  }

  const ready = missing.length === 0;
  const reason = ready
    ? 'OK'
    : `Missing required configuration: ${missing.map((k) => KEY_LABELS[k] ?? k).join(', ')}`;

  return { ready, reason, missing };
}

/**
 * Returns { ready, reason, missing[] }. ready is true only when all required keys exist and are non-empty.
 * missing[] contains key names (e.g. OPENAI_API_KEY) for audit/admin; never actual key values.
 */
export async function assertAiReady(context: AiReadinessContext): Promise<AssertAiReadyResult> {
  const config = await getRuntimeConfig();
  return checkAiReadyFromConfig(config, context);
}

/**
 * Readiness summary for admin dashboard: which keys are set and whether chat is ready per provider.
 */
export async function getReadinessSummary(): Promise<{
  openai: boolean;
  anthropic: boolean;
  lakera: boolean;
  lakeraProjectId: boolean;
  chatReadyOpenAI: boolean;
  chatReadyAnthropic: boolean;
  chatReadyWithLakeraOpenAI: boolean;
  chatReadyWithLakeraAnthropic: boolean;
}> {
  const config = await getRuntimeConfig();
  const openai = !!config.openaiApiKey?.trim();
  const anthropic = !!config.anthropicApiKey?.trim();
  const lakera = !!config.lakeraApiKey?.trim();
  const lakeraProjectId = !!config.lakeraProjectId?.trim();
  const lakeraOk = lakera && lakeraProjectId;

  return {
    openai,
    anthropic,
    lakera,
    lakeraProjectId,
    chatReadyOpenAI: openai,
    chatReadyAnthropic: anthropic,
    chatReadyWithLakeraOpenAI: openai && lakeraOk,
    chatReadyWithLakeraAnthropic: anthropic && lakeraOk,
  };
}
