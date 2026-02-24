/**
 * POST /api/chat/confirm-action
 * Body: { actionId: string, confirm: boolean }
 * Confirms or cancels a pending action; on confirm, executes the action tool and returns final message.
 */

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import {
  getPendingActionById,
  confirmPendingAction,
  cancelPendingAction,
  markExecuted,
  markFailed,
  PENDING_ACTION_TYPE,
} from '@/lib/actions/pendingActions';
import { executeToolSafely } from '@/lib/banking/execute-tool-safely';
import { buildSystemPrompt } from '@/lib/security/prompt-firewall';
import { chatWithAdapter, type ChatMessage } from '@/lib/chat-adapter';
import { formatTrustedToolOutput } from '@/lib/chat/promptParts';
import { getSecret, getConfig } from '@/lib/admin/secrets-store';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const bodySchema = z.object({
  actionId: z.string().min(1),
  confirm: z.boolean(),
});

export async function POST(request: Request) {
  let userId: string;
  try {
    const session = await requireSession();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed } = checkRateLimit(`confirm:${userId}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many confirmation requests. Please try again later.' }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body: actionId and confirm required' }, { status: 400 });
  }

  const action = await getPendingActionById(userId, body.actionId);
  if (!action) {
    return NextResponse.json({ error: 'Action not found or expired' }, { status: 404 });
  }
  if (action.status !== 'PENDING') {
    return NextResponse.json({
      error: 'Action already handled',
      message: 'This request has already been confirmed or cancelled.',
    }, { status: 400 });
  }
  if (action.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Action expired' }, { status: 400 });
  }

  if (!body.confirm) {
    await cancelPendingAction(userId, body.actionId);
    return NextResponse.json({
      message: 'Request cancelled. No changes were made.',
      pendingActionId: body.actionId,
    });
  }

  const confirmed = await confirmPendingAction(userId, body.actionId);
  if (!confirmed) {
    return NextResponse.json({ error: 'Could not confirm action' }, { status: 400 });
  }

  // Tool args are built only from stored PendingAction payload (server-authoritative). Propose → confirm → execute.
  const payload = action.payload as { fromAccount?: string; toAccount?: string; amount?: number; increaseAmount?: number };
  const correlationId = `confirm-${Date.now()}`;
  const [lakeraKey, projectId] = await Promise.all([
    getSecret('LAKERA_API_KEY'),
    getConfig('LAKERA_PROJECT_ID'),
  ]);

  let toolResult: { success: boolean; data?: unknown; error?: string } = { success: false, error: 'Unknown action' };
  if (action.type === PENDING_ACTION_TYPE.TRANSFER && payload.fromAccount && payload.toAccount && payload.amount) {
    toolResult = await executeToolSafely({
      toolName: 'banking.transferFunds',
      toolArgs: { fromAccount: payload.fromAccount, toAccount: payload.toAccount, amount: payload.amount },
      userId,
      correlationId,
      apiKey: lakeraKey,
      projectId,
    });
  } else if (action.type === PENDING_ACTION_TYPE.CREDIT_INCREASE && payload.increaseAmount != null) {
    toolResult = await executeToolSafely({
      toolName: 'banking.requestCreditIncrease',
      toolArgs: { amount: payload.increaseAmount, reason: 'User confirmed via confirm button' },
      userId,
      correlationId,
      apiKey: lakeraKey,
      projectId,
    });
  }

  if (toolResult.success && toolResult.data) {
    await markExecuted(userId, body.actionId);
    const toolName = action.type === PENDING_ACTION_TYPE.TRANSFER ? 'banking.transferFunds' : 'banking.requestCreditIncrease';
    const toolContextForResponse = formatTrustedToolOutput(toolName, toolResult.data, { userId });
    const provider = (process.env.CHAT_PROVIDER === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic';
    const [openaiKey, anthropicKey] = await Promise.all([getSecret('OPENAI_API_KEY'), getSecret('ANTHROPIC_API_KEY')]);
    const systemPromptBase = buildSystemPrompt('support', '');
    const systemPrompt = systemPromptBase + `\n\nTrusted Tool Output (use ONLY this data):\n${toolContextForResponse}`;
    const messages: ChatMessage[] = [{ role: 'user', content: 'I confirmed the action.' }, { role: 'assistant', content: '' }];
    const result = await chatWithAdapter(messages, systemPrompt, provider, { openai: openaiKey, anthropic: anthropicKey });
    return NextResponse.json({
      message: result.content,
      actionExecuted: true,
      pendingActionId: body.actionId,
      data: toolResult.data,
    });
  }

  await markFailed(userId, body.actionId, toolResult.error ?? 'Execution failed');
  return NextResponse.json({
    message: toolResult.error ?? 'The action could not be completed. Please try again.',
    actionExecuted: false,
    pendingActionId: body.actionId,
  });
}
