/**
 * Tool plan from intent (or regex fallback). Read-only tools + action proposals (PendingAction).
 */

import type { IntentResult } from './intent.schema';
import { isAccountSpecificQuery } from '@/lib/ai/tools';

export type ToolPlanStep =
  | { kind: 'tool'; tool: 'banking.getBalances' | 'banking.getRecentTransactions' | 'banking.getCreditProfile' }
  | { kind: 'proposal'; type: 'TRANSFER'; payload: { fromAccount: string; toAccount: string; amount: number } }
  | { kind: 'proposal'; type: 'CREDIT_INCREASE'; payload: { increaseAmount: number; recommendedLimit?: number } }
  | { kind: 'clarification'; type: 'TRANSFER_AMOUNT'; fromAccount: string; toAccount: string };

export type ToolPlan = { steps: ToolPlanStep[]; useRag: boolean };

const ACCOUNT_MAP: Record<string, string> = {
  checking: 'checking',
  savings: 'savings',
  credit: 'credit',
};

export function buildToolPlan(intentResult: IntentResult | null, message: string): ToolPlan {
  const lower = message.toLowerCase();

  if (intentResult && intentResult.confidence >= 0.6) {
    switch (intentResult.intent) {
      case 'balance_inquiry':
        return { steps: [{ kind: 'tool', tool: 'banking.getBalances' }], useRag: false };
      case 'transactions':
        return { steps: [{ kind: 'tool', tool: 'banking.getRecentTransactions' }], useRag: false };
      case 'credit_profile':
        return { steps: [{ kind: 'tool', tool: 'banking.getCreditProfile' }], useRag: false };
      case 'credit_increase_request': {
        const amount = intentResult.slots.requested_increase_amount ?? intentResult.slots.requested_credit_limit;
        return {
          steps: [
            { kind: 'tool', tool: 'banking.getCreditProfile' },
            { kind: 'tool', tool: 'banking.getBalances' },
            { kind: 'proposal', type: 'CREDIT_INCREASE', payload: { increaseAmount: amount ?? 0, recommendedLimit: undefined } },
          ],
          useRag: false,
        };
      }
      case 'transfer_request': {
        const amount = intentResult.slots.amount ?? 0;
        const from = intentResult.slots.from_account ? ACCOUNT_MAP[intentResult.slots.from_account] ?? intentResult.slots.from_account : 'checking';
        const to = intentResult.slots.to_account ? ACCOUNT_MAP[intentResult.slots.to_account] ?? intentResult.slots.to_account : 'savings';
        if (amount > 0 && from && to && from !== to) {
          return {
            steps: [
              { kind: 'tool', tool: 'banking.getBalances' },
              { kind: 'proposal', type: 'TRANSFER', payload: { fromAccount: from, toAccount: to, amount } },
            ],
            useRag: false,
          };
        }
        if (from && to && from !== to) {
          return {
            steps: [
              { kind: 'tool', tool: 'banking.getBalances' },
              { kind: 'clarification', type: 'TRANSFER_AMOUNT', fromAccount: from, toAccount: to },
            ],
            useRag: false,
          };
        }
        return { steps: [], useRag: true };
      }
      case 'general_qna':
      case 'unknown':
      default:
        return { steps: [], useRag: true };
    }
  }

  // Regex fallback (existing behavior + transfer)
  if (!isAccountSpecificQuery(message)) {
    return { steps: [], useRag: true };
  }
  const steps: ToolPlanStep[] = [{ kind: 'tool', tool: 'banking.getBalances' }];
  if (/\b(transaction|recent|history)\b/i.test(message)) {
    steps.push({ kind: 'tool', tool: 'banking.getRecentTransactions' });
  }
  if (/\b(credit\s*limit|utilization|increase|eligibility)\b/i.test(message)) {
    steps.push({ kind: 'tool', tool: 'banking.getCreditProfile' });
  }
  // Regex-based transfer: "transfer 500 from checking to savings" or "transfer $100 to savings"
  if (/\btransfer\b/i.test(message)) {
    const amountMatch = message.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?|\d+)\s*(?:dollars?)?/i);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    const fromChecking = /\bfrom\s+checking\b/i.test(message) || (/\bto\s+savings\b/i.test(message) && !/\bfrom\s+savings\b/i.test(message));
    const fromSavings = /\bfrom\s+savings\b/i.test(message);
    const toChecking = /\bto\s+checking\b/i.test(message);
    const toSavings = /\bto\s+savings\b/i.test(message) || (/\bfrom\s+checking\b/i.test(message) && !/\bto\s+checking\b/i.test(message));
    const from = fromSavings ? 'savings' : 'checking';
    const to = toChecking ? 'checking' : toSavings ? 'savings' : from === 'checking' ? 'savings' : 'checking';
    if (amount > 0 && from !== to) {
      steps.push({ kind: 'proposal', type: 'TRANSFER', payload: { fromAccount: from, toAccount: to, amount } });
    }
  }
  return { steps, useRag: false };
}
