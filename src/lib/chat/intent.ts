/**
 * Optional intent step. Uses a small/cheap model to produce strict JSON.
 * If CHAT_INTENT_ENABLED=false or parse fails, return null (fallback to regex).
 */

import { intentResultSchema, type IntentResult } from './intent.schema';
import { chatWithAdapter, type ChatMessage } from '@/lib/chat-adapter';

const CHAT_INTENT_ENABLED = process.env.CHAT_INTENT_ENABLED === 'true';
const INTENT_CONFIDENCE_THRESHOLD = Number(process.env.CHAT_INTENT_CONFIDENCE_THRESHOLD) || 0.6;

const INTENT_SYSTEM = `You are a classifier. Reply with ONLY a single JSON object, no markdown or explanation.
Schema: { "intent": "balance_inquiry"|"transactions"|"credit_profile"|"credit_increase_request"|"transfer_request"|"general_qna"|"unknown", "confidence": number 0-1, "needs_clarification": boolean, "slots": { "amount"?: number, "from_account"?: "checking"|"savings"|"credit", "to_account"?: "checking"|"savings"|"credit", "requested_credit_limit"?: number, "requested_increase_amount"?: number } }
Rules: Use balance_inquiry for balance/checking/savings/credit balance. Use transactions for recent transactions/history. Use credit_profile for utilization, payment history, credit limit (read-only). Use credit_increase_request when user wants to increase credit limit. Use transfer_request when user wants to move money between accounts. Use general_qna for product/how-to. Use unknown if unclear. Extract amounts and account types into slots when mentioned.`;

export type DetectIntentInput = {
  message: string;
  userContext?: Record<string, unknown>;
  openaiKey?: string | null;
  anthropicKey?: string | null;
};

export async function detectIntent(input: DetectIntentInput): Promise<IntentResult | null> {
  if (!CHAT_INTENT_ENABLED) return null;
  const provider = (process.env.CHAT_PROVIDER === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic';
  const keys = { openai: input.openaiKey, anthropic: input.anthropicKey };
  const messages: ChatMessage[] = [{ role: 'user', content: input.message }];
  try {
    const result = await chatWithAdapter(
      messages,
      INTENT_SYSTEM,
      provider,
      keys
    );
    const trimmed = result.content.replace(/^[\s`]*/g, '').replace(/[\s`]*$/g, '').replace(/^json\s*/i, '');
    const parsed = JSON.parse(trimmed) as unknown;
    return intentResultSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function isIntentConfident(result: IntentResult | null): boolean {
  return result != null && result.confidence >= INTENT_CONFIDENCE_THRESHOLD;
}
