/**
 * Risk scoring rubric: category weights, contextual multipliers, and risk level mapping.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const CATEGORY_WEIGHTS: Record<string, number> = {
  prompt_injection: 0.95,
  jailbreak: 0.9,
  system_prompt_extraction: 0.9,
  data_exfil: 0.85,
  data_exfiltration: 0.85,
  fraud: 0.85,
  fraud_or_criminal_intent: 0.85,
  tool_abuse: 0.9,
  malware_code_abuse: 0.9,
  policy_violation: 0.6,
  pii: 0.5,
  other: 0.3,
};

export type ContextualMultiplier =
  | 'financial_pii'
  | 'cross_tenant'
  | 'tool_invocation_attempt'
  | 'rag_contamination'
  | 'none';

export const CONTEXTUAL_MULTIPLIERS: Record<ContextualMultiplier, number> = {
  financial_pii: 1.4,
  cross_tenant: 1.5,
  tool_invocation_attempt: 1.3,
  rag_contamination: 1.35,
  none: 1.0,
};

export type RiskInput = {
  normalizedCategories: string[];
  inputSeverity?: 'low' | 'medium' | 'high' | 'critical';
  outputSeverity?: 'low' | 'medium' | 'high' | 'critical';
  inputScore?: number;
  outputScore?: number;
  contextual?: ContextualMultiplier;
};

const severityToNumber = (s?: string): number => {
  if (!s) return 0;
  switch (s) {
    case 'critical': return 1;
    case 'high': return 0.75;
    case 'medium': return 0.5;
    case 'low': return 0.25;
    default: return 0;
  }
};

/**
 * Compute composite risk score in [0, 1] and map to risk level.
 */
export function computeRiskScore(input: RiskInput): { score: number; level: RiskLevel } {
  let score = 0;
  const cats = input.normalizedCategories?.length ? input.normalizedCategories : ['other'];
  for (const c of cats) {
    const w = CATEGORY_WEIGHTS[c] ?? CATEGORY_WEIGHTS.other;
    score = Math.max(score, w);
  }
  const inS = input.inputScore ?? severityToNumber(input.inputSeverity);
  const outS = input.outputScore ?? severityToNumber(input.outputSeverity);
  const severityComponent = (inS + outS) / 2;
  score = Math.min(1, score * 0.6 + severityComponent * 0.4);
  const mult = input.contextual ? CONTEXTUAL_MULTIPLIERS[input.contextual] : 1;
  score = Math.min(1, score * mult);

  let level: RiskLevel = 'LOW';
  if (score >= 0.75) level = 'CRITICAL';
  else if (score >= 0.5) level = 'HIGH';
  else if (score >= 0.25) level = 'MEDIUM';

  return { score, level };
}

export function mapScoreToLevel(score: number): RiskLevel {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.5) return 'HIGH';
  if (score >= 0.25) return 'MEDIUM';
  return 'LOW';
}
