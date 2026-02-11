import { prisma } from './db';
import OpenAI from 'openai';

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const SIMILARITY_TOP_K = 5;

export type GetRelevantChunksOptions = {
  /** Include finance RAG chunks (Uxxx_profile/accounts/transactions). Only true when user is verified to avoid cross-user leakage. */
  includeFinance?: boolean;
  /** OpenAI API key for embeddings. When provided (e.g. from chat route), RAG works even if env is not set. */
  openaiApiKey?: string | null;
};

/**
 * RAG retrieval scoped strictly by userId. Only returns chunks tagged with that user_id.
 * Set includeFinance: true only after identity verification (last4); otherwise finance chunks are excluded.
 * Uses openaiApiKey when provided; otherwise falls back to process.env.OPENAI_API_KEY.
 * RAG runs when an API key is available and RAG_ENABLED is not explicitly 'false' (so local dev works without RAG_ENABLED=true).
 */
export async function getRelevantChunks(
  query: string,
  userId: string,
  options: GetRelevantChunksOptions = {}
): Promise<string[]> {
  const { includeFinance = true, openaiApiKey } = options;
  const apiKey = openaiApiKey ?? process.env.OPENAI_API_KEY;
  const ragDisabled = process.env.RAG_ENABLED === 'false';
  if (!apiKey || ragDisabled) return [];

  const openai = new OpenAI({ apiKey });
  const embeddingRes = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query.slice(0, 8000),
  });
  const queryEmbedding = embeddingRes.data[0]?.embedding;
  if (!queryEmbedding || !Array.isArray(queryEmbedding)) return [];

  const allChunks: { content: string; embedding: number[]; chunkIndex: number }[] = [];

  const files = await prisma.fileUpload.findMany({
    where: { userId, approved: true, quarantined: false },
    include: { chunks: true },
  });
  for (const f of files) {
    for (const c of f.chunks) {
      const emb = c.embedding as unknown;
      if (Array.isArray(emb)) allChunks.push({ content: c.content, embedding: emb as number[], chunkIndex: c.chunkIndex });
    }
  }

  if (includeFinance) {
    const financeChunks = await prisma.financeRagChunk.findMany({
      where: { userId },
      orderBy: { chunkIndex: 'asc' },
    });
    for (const c of financeChunks) {
      const emb = c.embedding as unknown;
      if (Array.isArray(emb)) allChunks.push({ content: c.content, embedding: emb as number[], chunkIndex: c.chunkIndex });
    }
  }

  if (allChunks.length === 0) return [];

  function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const den = Math.sqrt(na) * Math.sqrt(nb);
    return den === 0 ? 0 : dot / den;
  }

  const withScore = allChunks.map((c) => ({ ...c, score: cosineSimilarity(c.embedding, queryEmbedding) }));
  withScore.sort((a, b) => b.score - a.score);
  return withScore.slice(0, SIMILARITY_TOP_K).map((c) => c.content);
}
