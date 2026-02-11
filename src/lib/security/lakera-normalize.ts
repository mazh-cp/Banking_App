/**
 * Normalized Lakera categories for policy and audit.
 * Used by both v1 and v2 integrations.
 */

export type NormalizedCategory =
  | 'prompt_injection'
  | 'data_exfiltration'
  | 'jailbreak'
  | 'fraud_or_criminal_intent'
  | 'system_prompt_extraction'
  | 'tool_abuse'
  | 'pii'
  | 'malware_code_abuse'
  | 'policy_violation'
  | 'other';

const MAP: Record<string, NormalizedCategory> = {
  prompt_injection: 'prompt_injection',
  prompt_injection_attempt: 'prompt_injection',
  data_exfiltration: 'data_exfiltration',
  data_exfil: 'data_exfiltration',
  jailbreak: 'jailbreak',
  jailbreaking: 'jailbreak',
  fraud: 'fraud_or_criminal_intent',
  fraud_coaching: 'fraud_or_criminal_intent',
  fraud_or_criminal_intent: 'fraud_or_criminal_intent',
  system_prompt_extraction: 'system_prompt_extraction',
  tool_abuse: 'tool_abuse',
  pii: 'pii',
  pii_leak: 'pii',
  malware: 'malware_code_abuse',
  code_abuse: 'malware_code_abuse',
  harmful_content: 'policy_violation',
  policy_violation: 'policy_violation',
  hate: 'policy_violation',
  violence: 'policy_violation',
};

export function normalizeCategories(raw: unknown): {
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
          const key = k.toLowerCase().replace(/\s+/g, '_');
          const n = MAP[key] ?? MAP[k] ?? 'other';
          normalizedSet.add(n);
        }
      }
    }
  }
  return { categories, normalized: Array.from(normalizedSet) };
}
