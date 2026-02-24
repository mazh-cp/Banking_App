/**
 * Shared OpenAI-compatible client for embeddings.
 * When LITELLM_PROXY_URL is set, requests go through LiteLLM proxy for load balancing, cost tracking, and caching.
 * @see https://github.com/BerriAI/litellm
 */

import OpenAI from 'openai';

const LITELLM_PROXY_URL = process.env.LITELLM_PROXY_URL?.replace(/\/$/, '');
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || process.env.OPENAI_API_KEY || '';
const DEFAULT_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const LITELLM_EMBEDDING_MODEL = process.env.LITELLM_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

export function getEmbeddingModel(): string {
  return LITELLM_PROXY_URL ? LITELLM_EMBEDDING_MODEL : DEFAULT_EMBEDDING_MODEL;
}

/**
 * Returns an OpenAI-compatible client for embeddings.
 * When LITELLM_PROXY_URL is set, uses the proxy (single gateway, optional caching/cost tracking).
 */
export function getEmbeddingClient(apiKey?: string | null): OpenAI {
  const key = apiKey ?? (LITELLM_PROXY_URL ? LITELLM_API_KEY : process.env.OPENAI_API_KEY);
  if (!key) throw new Error('API key not configured for embeddings');
  if (LITELLM_PROXY_URL) {
    return new OpenAI({
      apiKey: key,
      baseURL: `${LITELLM_PROXY_URL}/v1`,
    });
  }
  return new OpenAI({ apiKey: key });
}
