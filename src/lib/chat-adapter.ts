import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

const OPENAI_MODEL = process.env.CHAT_MODEL_OPENAI || 'gpt-4o-mini';
const ANTHROPIC_MODEL = process.env.CHAT_MODEL_ANTHROPIC || 'claude-3-5-sonnet-20241022';

/** When set, all chat goes through LiteLLM proxy (OpenAI-compatible). Enables load balancing, cost tracking, fallback. */
const LITELLM_PROXY_URL = process.env.LITELLM_PROXY_URL?.replace(/\/$/, '');
const LITELLM_CHAT_MODEL = process.env.LITELLM_CHAT_MODEL || OPENAI_MODEL;
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || process.env.OPENAI_API_KEY || '';

const CHAT_RETRY_ATTEMPTS = 1;
const CHAT_RETRY_DELAY_MS = 1000;

function isRetryableError(e: unknown): boolean {
  if (e && typeof e === 'object' && 'status' in e && typeof (e as { status: number }).status === 'number') {
    const status = (e as { status: number }).status;
    return status >= 500 && status < 600;
  }
  if (e instanceof Error && e.message?.includes('ECONNRESET')) return true;
  return false;
}

export async function chatViaLiteLLM(messages: ChatMessage[], systemPrompt: string, apiKey?: string | null): Promise<string> {
  if (!LITELLM_PROXY_URL) throw new Error('LITELLM_PROXY_URL not configured');
  const key = apiKey ?? LITELLM_API_KEY;
  const openai = new OpenAI({
    apiKey: key,
    baseURL: `${LITELLM_PROXY_URL}/v1`,
  });
  const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];
  let lastError: unknown;
  for (let attempt = 0; attempt <= CHAT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: LITELLM_CHAT_MODEL,
        messages: apiMessages,
        max_tokens: 2048,
      });
      const content = completion.choices[0]?.message?.content;
      return content ?? '';
    } catch (e) {
      lastError = e;
      if (attempt < CHAT_RETRY_ATTEMPTS && isRetryableError(e)) {
        await new Promise((r) => setTimeout(r, CHAT_RETRY_DELAY_MS));
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error('Chat request failed');
}

export async function chatOpenAI(messages: ChatMessage[], systemPrompt: string, apiKey?: string | null): Promise<string> {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI API key not configured');
  const openai = new OpenAI({ apiKey: key });
  const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt <= CHAT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: apiMessages,
        max_tokens: 2048,
      });
      const content = completion.choices[0]?.message?.content;
      return content ?? '';
    } catch (e) {
      lastError = e;
      if (attempt < CHAT_RETRY_ATTEMPTS && isRetryableError(e)) {
        await new Promise((r) => setTimeout(r, CHAT_RETRY_DELAY_MS));
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error('Chat request failed');
}

export async function chatAnthropic(messages: ChatMessage[], systemPrompt: string, apiKey?: string | null): Promise<string> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key not configured');
  const anthropic = new Anthropic({ apiKey: key });
  const apiMessages: Anthropic.MessageParam[] = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  let lastError: unknown;
  for (let attempt = 0; attempt <= CHAT_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: apiMessages,
      });
      const block = response.content.find((b) => b.type === 'text');
      return block && 'text' in block ? block.text : '';
    } catch (e) {
      lastError = e;
      if (attempt < CHAT_RETRY_ATTEMPTS && isRetryableError(e)) {
        await new Promise((r) => setTimeout(r, CHAT_RETRY_DELAY_MS));
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new Error('Chat request failed');
}

export type ChatAdapterResult = { content: string; model: string; provider: string };

export type AdapterKeys = { openai?: string | null; anthropic?: string | null };

export async function chatWithAdapter(
  messages: ChatMessage[],
  systemPrompt: string,
  provider: 'openai' | 'anthropic',
  keys?: AdapterKeys
): Promise<ChatAdapterResult> {
  if (LITELLM_PROXY_URL) {
    const key = keys?.openai ?? keys?.anthropic ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    const content = await chatViaLiteLLM(messages, systemPrompt, key);
    return { content, model: LITELLM_CHAT_MODEL, provider: 'litellm' };
  }
  if (provider === 'anthropic') {
    const content = await chatAnthropic(messages, systemPrompt, keys?.anthropic);
    return { content, model: ANTHROPIC_MODEL, provider: 'anthropic' };
  }
  const content = await chatOpenAI(messages, systemPrompt, keys?.openai);
  return { content, model: OPENAI_MODEL, provider: 'openai' };
}
