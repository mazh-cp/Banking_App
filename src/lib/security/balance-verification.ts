/**
 * Deterministic balance verification: detect LLM hallucination when output contains
 * balance-like numbers that don't match authoritative tool results.
 */

type Balances = { checking?: number; savings?: number; creditCardBalance?: number; creditLimit?: number; availableCredit?: number };

const BALANCE_KEYWORDS = /\b(balance|balances|checking|savings|credit\s*card|available|you\s*have|total\s*of)\b/i;

/** Extract dollar amounts from text (e.g. $1,234.56 or 1234.56). */
function extractDollarAmounts(text: string): number[] {
  const amounts: number[] = [];
  const regex = /\$?([\d,]+(?:\.\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(num) && num >= 0) amounts.push(num);
  }
  return amounts;
}

/** Build set of authoritative values from balance data. */
function getAuthoritativeValues(balances: Balances): Set<number> {
  const s = new Set<number>();
  const vals = [
    balances.checking,
    balances.savings,
    balances.creditCardBalance,
    balances.creditLimit,
    balances.availableCredit,
  ].filter((v) => typeof v === 'number');
  for (const v of vals) {
    s.add(Math.round(v * 100) / 100);
    s.add(Math.round(Math.abs(v) * 100) / 100);
  }
  return s;
}

/**
 * Returns true if the text contains balance-like numbers that don't match
 * authoritative tool data (potential hallucination). Only checks when text
 * mentions balance-related keywords to avoid false positives on transfer amounts.
 */
export function hasBalanceMismatch(text: string, authoritativeBalances: Balances | null): boolean {
  if (!authoritativeBalances) return false;
  if (!BALANCE_KEYWORDS.test(text)) return false;
  const auth = getAuthoritativeValues(authoritativeBalances);
  if (auth.size === 0) return false;
  const amounts = extractDollarAmounts(text);
  const tolerance = 0.02;
  for (const a of amounts) {
    const rounded = Math.round(a * 100) / 100;
    const matches = Array.from(auth).some((v) => Math.abs(v - rounded) < tolerance || Math.abs(Math.abs(v) - rounded) < tolerance);
    if (!matches && rounded >= 1 && rounded <= 1e9) return true;
  }
  return false;
}
