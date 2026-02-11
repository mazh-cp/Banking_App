/**
 * Sensitive intent classifier for chat.
 * Account-specific = balances, transactions, credit limit, loan status, etc.
 */

export function isAccountSpecificQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const patterns = [
    /\b(my|our)\s+(checking|savings|account|balance|balances)\b/,
    /\b(what'?s?|what is)\s+(my|the)\s+(balance|checking|savings|credit)/,
    /\b(how much|balance)\s+(do i have|in my)/,
    /\b(credit\s*(limit|line|utilization)|available\s*credit)\b/,
    /\b(recent\s*)?transactions?\b/,
    /\b(increase\s*my\s*credit|credit\s*increase|raise\s*(my\s*)?limit)\b/,
    /\b(payment\s*history|utilization)\b/,
    /\b(account\s*number|statement|payments?)\b/,
    /\b(loan\s*status|application\s*status)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}
