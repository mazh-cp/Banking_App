import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

const OPENAI_MODEL = process.env.CHAT_MODEL_OPENAI || 'gpt-4o-mini';
const ANTHROPIC_MODEL = process.env.CHAT_MODEL_ANTHROPIC || 'claude-3-5-sonnet-20241022';

export async function chatOpenAI(messages: ChatMessage[], systemPrompt: string, apiKey?: string | null): Promise<string> {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI API key not configured');
  const openai = new OpenAI({ apiKey: key });
  const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: apiMessages,
    max_tokens: 2048,
  });

  const content = completion.choices[0]?.message?.content;
  return content ?? '';
}

export async function chatAnthropic(messages: ChatMessage[], systemPrompt: string, apiKey?: string | null): Promise<string> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key not configured');
  const anthropic = new Anthropic({ apiKey: key });
  const apiMessages: Anthropic.MessageParam[] = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: apiMessages,
  });

  const block = response.content.find((b) => b.type === 'text');
  return block && 'text' in block ? block.text : '';
}

export type ChatAdapterResult = { content: string; model: string; provider: string };

export type AdapterKeys = { openai?: string | null; anthropic?: string | null };

export async function chatWithAdapter(
  messages: ChatMessage[],
  systemPrompt: string,
  provider: 'openai' | 'anthropic',
  keys?: AdapterKeys
): Promise<ChatAdapterResult> {
  if (provider === 'anthropic') {
    const content = await chatAnthropic(messages, systemPrompt, keys?.anthropic);
    return { content, model: ANTHROPIC_MODEL, provider: 'anthropic' };
  }
  const content = await chatOpenAI(messages, systemPrompt, keys?.openai);
  return { content, model: OPENAI_MODEL, provider: 'openai' };
}
