/**
 * Banking tools for chat. Server-only; require authenticated userId.
 * Used by /api/chat to fetch account data so the LLM never guesses balances.
 */

import {
  getBalances,
  getRecentTransactions,
  getCreditProfile,
  requestCreditIncrease,
  transferFunds,
  computeSnapshotHash,
  type Balances,
  type RecentTransaction,
  type CreditProfile,
} from '@/lib/banking/banking-service';

export type ToolName =
  | 'banking.getBalances'
  | 'banking.getRecentTransactions'
  | 'banking.getCreditProfile'
  | 'banking.requestCreditIncrease'
  | 'banking.transferFunds';

export type ToolResult = {
  tool: ToolName;
  success: boolean;
  data?: unknown;
  error?: string;
  snapshotHash?: string;
  asOf?: string;
};

/**
 * Run a banking tool. userId must come from session only, never from client.
 */
export type ToolArgs = {
  amount?: number;
  reason?: string;
  fromAccount?: string;
  toAccount?: string;
};

export async function runBankingTool(
  tool: ToolName,
  userId: string,
  args?: ToolArgs
): Promise<ToolResult> {
  try {
    switch (tool) {
      case 'banking.getBalances': {
        const data = await getBalances(userId);
        const snapshotHash = computeSnapshotHash(data);
        return {
          tool: 'banking.getBalances',
          success: true,
          data,
          snapshotHash,
          asOf: data.asOf,
        };
      }
      case 'banking.getRecentTransactions': {
        const data = await getRecentTransactions(userId, 10);
        return {
          tool: 'banking.getRecentTransactions',
          success: true,
          data,
        };
      }
      case 'banking.getCreditProfile': {
        const data = await getCreditProfile(userId);
        return {
          tool: 'banking.getCreditProfile',
          success: true,
          data,
        };
      }
      case 'banking.requestCreditIncrease': {
        const amount = args?.amount ?? 0;
        const reason = args?.reason ?? '';
        const data = await requestCreditIncrease(userId, amount, reason);
        return {
          tool: 'banking.requestCreditIncrease',
          success: true,
          data,
        };
      }
      case 'banking.transferFunds': {
        const fromAccount = args?.fromAccount ?? 'checking';
        const toAccount = args?.toAccount ?? 'savings';
        const amount = args?.amount ?? 0;
        const data = await transferFunds(userId, fromAccount, toAccount, amount);
        return {
          tool: 'banking.transferFunds',
          success: true,
          data,
          asOf: data.postedAt,
        };
      }
      default:
        return { tool, success: false, error: 'Unknown tool' };
    }
  } catch (e) {
    return {
      tool,
      success: false,
      error: e instanceof Error ? e.message : 'Tool failed',
    };
  }
}

/** Tool schemas for documentation / LLM context (not for client). */
export const BANKING_TOOL_SCHEMAS = {
  'banking.getBalances': {
    description: 'Get the user’s checking, savings, credit card balance, credit limit, and available credit.',
    params: [],
  },
  'banking.getRecentTransactions': {
    description: 'Get the user’s recent transactions (type, amount, description, date).',
    params: [],
  },
  'banking.getCreditProfile': {
    description: 'Get credit utilization, payment history summary, and recommended actions. Do not disclose internal thresholds.',
    params: [],
  },
  'banking.requestCreditIncrease': {
    description: 'Submit a simulated credit limit increase request. Requires amount and reason.',
    params: [{ name: 'amount', type: 'number' }, { name: 'reason', type: 'string' }],
  },
  'banking.transferFunds': {
    description: 'Transfer funds between the user’s own accounts (checking, savings). Requires fromAccount, toAccount, amount. Only after user confirmation.',
    params: [{ name: 'fromAccount', type: 'string' }, { name: 'toAccount', type: 'string' }, { name: 'amount', type: 'number' }],
  },
} as const;

/**
 * Detect if the user message is account-specific (balance, transactions, credit, limit, transfer).
 * Used to decide whether to run tools before the model.
 */
export function isAccountSpecificQuery(content: string): boolean {
  const lower = content.toLowerCase();
  const patterns = [
    /\b(my|our)\s+(checking|savings|account|balance|balances)\b/,
    /\b(what'?s?|what is)\s+(my|the)\s+(balance|checking|savings|credit)/,
    /\b(my|our|the)\s+current\s+balance\b/i,
    /\bcurrent\s+balance\b/i,
    /\b(how much|balance)\s+(do i have|in my)/,
    /\b(credit\s*(limit|line|utilization)|available\s*credit)\b/,
    /\b(recent\s*)?transactions?\b/,
    /\b(increase\s*my\s*credit|credit\s*increase|raise\s*(my\s*)?limit)\b/,
    /\b(payment\s*history|utilization)\b/,
    /\btransfer\s+(money|funds)?\s*(from|to|between)/i,
    /\btransfer\b.*\b(checking|savings)\b/i,
  ];
  return patterns.some((p) => p.test(lower));
}

/**
 * Detect if the message looks like a transfer request (for hints when intent is off).
 */
export function isTransferLike(content: string): boolean {
  return /\btransfer\b/i.test(content);
}
