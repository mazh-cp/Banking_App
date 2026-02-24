/**
 * Defense-in-depth: block obvious jailbreak and cross-user/admin abuse phrases
 * even if Lakera Guard does not flag them. Used only when Security Mode is on.
 */

const PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior)\s+instructions?/i, reason: 'prompt_injection' },
  { pattern: /reveal\s+(your\s+)?(system\s+)?prompt/i, reason: 'system_prompt_extraction' },
  { pattern: /(you\s+are\s+now\s+in\s+)?admin\s+mode/i, reason: 'privilege_escalation' },
  { pattern: /(unrestricted|unfiltered)\s+assistant/i, reason: 'jailbreak' },
  { pattern: /(show|list|check|get)\s+(me\s+)?(all\s+)?(user|other\s+user|everyone'?s?)\s+(account\s+)?(balance|balances)/i, reason: 'data_exfiltration' },
  // "balance on/for <name>" where name is not an account type (e.g. "balance on Alisha khan")
  { pattern: /balance\s+(on|for)\s+(?!my|checking|savings|credit|card)\w+\s+\w+/i, reason: 'cross_user_balance' },
];

/**
 * Returns true if the raw user message matches known jailbreak/cross-user patterns.
 * Use the original (unredacted) user content for this check.
 */
export function containsObviousJailbreak(userContent: string): boolean {
  if (!userContent || typeof userContent !== 'string') return false;
  const normalized = userContent.trim();
  if (normalized.length === 0) return false;
  for (const { pattern } of PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}
