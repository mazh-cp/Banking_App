/**
 * Single wrapper for executing banking tools: allowlist, step-up auth, TOOL_ARGS screening.
 * Lakera TOOL_ARGS screen runs server-side before execution.
 */

import type { ToolName, ToolResult } from '@/lib/ai/tools';
import { runBankingTool } from '@/lib/ai/tools';
import { screenText } from '@/lib/security/lakera-guard';
import { getVerificationStatus } from '@/lib/chat/verification';
import { logSecurityEvent } from '@/lib/security/security-events';

const TOOL_ALLOWLIST: ToolName[] = [
  'banking.getBalances',
  'banking.getRecentTransactions',
  'banking.getCreditProfile',
  'banking.requestCreditIncrease',
  'banking.transferFunds',
];

const ALLOWED_TOOL_KEYS: Record<ToolName, string[]> = {
  'banking.getBalances': [],
  'banking.getRecentTransactions': [],
  'banking.getCreditProfile': [],
  'banking.requestCreditIncrease': ['amount', 'reason'],
  'banking.transferFunds': ['fromAccount', 'toAccount', 'amount'],
};

function validateAndSanitizeToolArgs(toolName: ToolName, args: Record<string, unknown>): { valid: boolean; sanitized: Record<string, unknown> } {
  const allowed = new Set(ALLOWED_TOOL_KEYS[toolName]);
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (allowed.has(k)) sanitized[k] = v;
    else return { valid: false, sanitized: {} };
  }
  return { valid: true, sanitized };
}

export type ExecuteToolSafelyParams = {
  toolName: ToolName;
  toolArgs: Record<string, unknown>;
  userId: string;
  correlationId: string;
  apiKey?: string | null;
  projectId?: string | null;
};

/**
 * 1) Verify tool in allowlist
 * 2) Verify step-up auth (SSN4) for sensitive tools
 * 3) Lakera TOOL_ARGS screen
 * 4) Execute tool
 */
export async function executeToolSafely(params: ExecuteToolSafelyParams): Promise<ToolResult> {
  const { toolName, toolArgs, userId, correlationId, apiKey, projectId } = params;

  if (!TOOL_ALLOWLIST.includes(toolName)) {
    return { tool: toolName, success: false, error: 'Tool not allowed' };
  }

  const { valid, sanitized } = validateAndSanitizeToolArgs(toolName, toolArgs);
  if (!valid) {
    return { tool: toolName, success: false, error: 'Invalid tool arguments: unexpected or disallowed keys.' };
  }

  const sensitiveTools: ToolName[] = ['banking.requestCreditIncrease', 'banking.transferFunds'];
  if (sensitiveTools.includes(toolName)) {
    const status = await getVerificationStatus(userId);
    if (!status.verified) {
      return {
        tool: toolName,
        success: false,
        error: 'Verification required. Please confirm the last 4 digits of your SSN first.',
      };
    }
  }

  const serializedArgs = JSON.stringify(sanitized);
  const decision = await screenText({
    stage: 'TOOL_ARGS',
    text: serializedArgs,
    userId,
    correlationId,
    apiKey,
    projectId,
  });

  await logSecurityEvent({
    correlationId,
    userId,
    stage: 'TOOL_ARGS',
    action: decision.action,
    reasonCodes: decision.reasonCodes,
    redactedPreview: decision.redactedText?.slice(0, 200),
    lakeraAvailable: !decision.reasonCodes.includes('lakera_unavailable'),
  });

  if (decision.action === 'block' || decision.action === 'mask') {
    return {
      tool: toolName,
      success: false,
      error: 'This action could not be completed. Please confirm the details and try again, or contact support.',
    };
  }

  // Monitor mode: when TOOL_ARGS would have been blocked, do not execute automatically; require user to re-submit or confirm.
  if (decision.wouldHaveBeenBlocked) {
    return {
      tool: toolName,
      success: false,
      error: 'This action was flagged in monitor mode and was not executed. In enforce mode it would be blocked. Please confirm the details and try again, or contact support.',
    };
  }

  let argsForTool: { amount?: number; reason?: string; fromAccount?: string; toAccount?: string } | undefined;
  if (toolName === 'banking.requestCreditIncrease') {
    argsForTool = { amount: (sanitized.amount as number) ?? 0, reason: (sanitized.reason as string) ?? '' };
  } else if (toolName === 'banking.transferFunds') {
    argsForTool = {
      fromAccount: (sanitized.fromAccount as string) ?? 'checking',
      toAccount: (sanitized.toAccount as string) ?? 'savings',
      amount: (sanitized.amount as number) ?? 0,
    };
  }

  return runBankingTool(toolName, userId, argsForTool);
}
