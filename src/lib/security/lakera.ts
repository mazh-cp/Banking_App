const LAKERA_GUARD_URL = 'https://api.lakera.ai/v1/guard';

export type LakeraScanOptions = {
  text: string;
  context?: string;
  userId?: string;
  mode?: 'input' | 'output' | 'file';
};

export type NormalizedCategory =
  | 'prompt_injection'
  | 'data_exfil'
  | 'fraud'
  | 'jailbreak'
  | 'system_prompt_extraction'
  | 'malware_code_abuse'
  | 'policy_violation'
  | 'pii'
  | 'other';

export type LakeraScanResult = {
  flagged: boolean;
  categories: Record<string, boolean>;
  normalizedCategories: NormalizedCategory[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  raw: unknown;
};

const LAKERA_TO_NORMALIZED: Record<string, NormalizedCategory> = {
  prompt_injection: 'prompt_injection',
  jailbreak: 'jailbreak',
  jailbreaking: 'jailbreak',
  prompt_injection_attempt: 'prompt_injection',
  data_exfiltration: 'data_exfil',
  data_exfil: 'data_exfil',
  pii: 'pii',
  pii_leak: 'pii',
  fraud: 'fraud',
  fraud_coaching: 'fraud',
  system_prompt_extraction: 'system_prompt_extraction',
  malware: 'malware_code_abuse',
  code_abuse: 'malware_code_abuse',
  harmful_content: 'policy_violation',
  policy_violation: 'policy_violation',
  hate: 'policy_violation',
  violence: 'policy_violation',
};

/**
 * Normalize Lakera API response into standard categories for risk scoring and audit.
 */
export function normalizeLakeraVerdict(raw: unknown): {
  categories: Record<string, boolean>;
  normalized: NormalizedCategory[];
} {
  const categories: Record<string, boolean> = {};
  const normalizedSet = new Set<NormalizedCategory>();
  if (raw && typeof raw === 'object' && 'categories' in raw) {
    const cat = (raw as { categories?: Record<string, boolean> }).categories;
    if (cat && typeof cat === 'object') {
      for (const [k, v] of Object.entries(cat)) {
        if (v) {
          categories[k] = true;
          const n = LAKERA_TO_NORMALIZED[k.toLowerCase().replace(/\s+/g, '_')] ?? LAKERA_TO_NORMALIZED[k] ?? 'other';
          normalizedSet.add(n);
        }
      }
    }
  }
  return { categories, normalized: Array.from(normalizedSet) };
}

function severityFromScore(score: number): LakeraScanResult['severity'] {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

/**
 * Scan text with Lakera Guard. Returns flagged, categories, severity, and raw response.
 * When LAKERA_GUARD_API_KEY is not set, returns a safe non-flagged result.
 */
export async function scanText(options: LakeraScanOptions & { apiKey?: string | null }): Promise<LakeraScanResult> {
  const { text, context, mode = 'input', apiKey: providedKey } = options;
  const apiKey = providedKey ?? process.env.LAKERA_GUARD_API_KEY ?? process.env.LAKERA_API_KEY;

  const defaultResult: LakeraScanResult = {
    flagged: false,
    categories: {},
    normalizedCategories: [],
    severity: 'low',
    raw: { skipped: 'no_api_key' },
  };

  if (!apiKey) {
    return defaultResult;
  }

  const body = {
    input: text.slice(0, 32000),
    ...(context && { context: context.slice(0, 8000) }),
  };

  try {
    const res = await fetch(LAKERA_GUARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Lakera Guard scan failed:', res.status, text);
      return {
        ...defaultResult,
        raw: { error: text, status: res.status },
      };
    }

    const data = (await res.json()) as {
      flagged?: boolean;
      categories?: Record<string, boolean>;
      risk_score?: number;
      [k: string]: unknown;
    };

    const score = typeof data.risk_score === 'number' ? data.risk_score : 0;
    const { categories: cat, normalized } = normalizeLakeraVerdict(data);
    return {
      flagged: Boolean(data.flagged),
      categories: data.categories ?? cat,
      normalizedCategories: normalized.length ? normalized : (Object.keys(cat).length ? ['other'] : []),
      severity: severityFromScore(score),
      raw: data,
    };
  } catch (e) {
    console.error('Lakera Guard error:', e);
    return {
      ...defaultResult,
      raw: { error: String(e) },
    };
  }
}
