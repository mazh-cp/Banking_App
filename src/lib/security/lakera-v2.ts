/**
 * Lakera Guard API v2: https://api.lakera.ai/v2/guard
 * Pre-scan, tool-safety gate, and post-scan. Use project_id for policy.
 */

import { getSecret } from '@/lib/admin/secrets-store';
import { getConfig } from '@/lib/admin/secrets-store';
import { normalizeCategories, type NormalizedCategory } from './lakera-normalize';

const LAKERA_V2_GUARD_URL = 'https://api.lakera.ai/v2/guard';

/** Map Lakera v2 breakdown detector_type to our normalized category. */
function detectorTypeToCategory(detectorType: string): NormalizedCategory {
  const key = detectorType.toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, NormalizedCategory> = {
    prompt_injection: 'prompt_injection',
    prompt_injection_attempt: 'prompt_injection',
    jailbreak: 'jailbreak',
    jailbreaking: 'jailbreak',
    data_exfiltration: 'data_exfiltration',
    data_exfil: 'data_exfiltration',
    fraud: 'fraud_or_criminal_intent',
    fraud_coaching: 'fraud_or_criminal_intent',
    system_prompt_extraction: 'system_prompt_extraction',
    tool_abuse: 'tool_abuse',
    pii: 'pii',
    malware: 'malware_code_abuse',
    code_abuse: 'malware_code_abuse',
    policy_violation: 'policy_violation',
    harmful_content: 'policy_violation',
  };
  return map[key] ?? 'other';
}

export type GuardTextOptions = {
  text: string;
  userId?: string;
  route?: string;
  persona?: string;
  mode: 'input' | 'output';
  context?: string;
};

export type GuardV2Result = {
  flagged: boolean;
  requestId?: string;
  categories: Record<string, boolean>;
  normalizedCategories: NormalizedCategory[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  raw: unknown;
};

function severityFromScore(score: number): GuardV2Result['severity'] {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

/**
 * Screen text with Lakera Guard v2. Uses messages format and project_id.
 */
export async function guardText(options: GuardTextOptions & { apiKey?: string | null; projectId?: string | null }): Promise<GuardV2Result> {
  const { text, userId, route, persona, mode, context, apiKey: providedKey, projectId: providedProjectId } = options;
  const apiKey = providedKey ?? await getSecret('LAKERA_API_KEY');
  const projectId = providedProjectId ?? await getConfig('LAKERA_PROJECT_ID');

  const defaultResult: GuardV2Result = {
    flagged: false,
    categories: {},
    normalizedCategories: [],
    severity: 'low',
    raw: { skipped: 'no_api_key' },
  };

  if (!apiKey) return defaultResult;

  const messages: { role: string; content: string }[] = [];
  if (context) messages.push({ role: 'user', content: `Context: ${context.slice(0, 8000)}` });
  if (mode === 'input') {
    messages.push({ role: 'user', content: text.slice(0, 32000) });
    messages.push({ role: 'assistant', content: '' });
  } else {
    messages.push({ role: 'user', content: '(user message)' });
    messages.push({ role: 'assistant', content: text.slice(0, 32000) });
  }

  const body: { messages: typeof messages; project_id?: string; breakdown?: boolean; metadata?: Record<string, string> } = {
    messages,
    breakdown: true,
  };
  if (projectId) body.project_id = projectId;
  if (userId || route || persona) {
    body.metadata = {};
    if (userId) body.metadata.user_id = userId;
    if (route) body.metadata.route = route;
    if (persona) body.metadata.persona = persona;
  }

  try {
    const res = await fetch(LAKERA_V2_GUARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Lakera Guard v2 failed:', res.status, text);
      return {
        ...defaultResult,
        raw: { error: text, status: res.status },
      };
    }

    const data = (await res.json()) as {
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

    const requestId = data.metadata?.request_uuid;
    const breakdown = data.breakdown;
    let score = 0;
    const fromBreakdown: NormalizedCategory[] = [];
    if (Array.isArray(breakdown) && breakdown.length) {
      for (const b of breakdown) {
        const isDetected = b.detected === true || b.flagged === true;
        if (isDetected) {
          if (typeof b.risk_score === 'number') score = Math.max(score, b.risk_score);
          const dt = b.detector_type ?? '';
          if (dt) fromBreakdown.push(detectorTypeToCategory(dt));
        }
      }
      if (Boolean(data.flagged) && score === 0) score = 0.6;
    }
    const { categories, normalized } = normalizeCategories(data);
    const normalizedCategories =
      fromBreakdown.length > 0 ? Array.from(new Set(fromBreakdown)) : normalized;
    return {
      flagged: Boolean(data.flagged),
      requestId,
      categories: data.categories ?? categories,
      normalizedCategories: normalizedCategories.length ? normalizedCategories : normalized,
      severity: severityFromScore(score),
      raw: data,
    };
  } catch (e) {
    console.error('Lakera Guard v2 error:', e);
    return { ...defaultResult, raw: { error: String(e) } };
  }
}

/**
 * Fetch detailed guard results by request ID (optional).
 */
export async function guardResults(requestId: string, apiKey?: string | null): Promise<unknown> {
  const key = apiKey ?? await getSecret('LAKERA_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch(`https://api.lakera.ai/v2/guard/results?request_id=${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
