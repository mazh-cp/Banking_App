/**
 * Tool plan from intent (or regex fallback). Read-only tools + action proposals (PendingAction).
 */

import type { IntentResult } from './intent.schema';
import { isAccountSpecificQuery } from '@/lib/ai/tools';

export type ToolPlanStep = 
  | { kind: 'tool'; tool: 'banking.getBalances' | 'banking.getRecentTransactions' | 'banking.getCreditProfile' }
  | { kind: 'proposal'; type: 'TRANSFER'; payload: { fromAccount: string; toAccount: string; amount: number } }
  | { kind: 'proposal'; type: 'CREDIT_INCREASE'; payload: { increaseAmount: number; recommendedLimit?: number } };

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
        return { steps: [], useRag: true };
      }
      case 'general_qna':
      case 'unknown':
      default:
        return { steps: [], useRag: true };
    }
  }

  // Regex fallback (existing behavior)
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
  return { steps, useRag: false };
}
