// In-memory rate limiter (use Redis in multi-instance deployments)
const windowMs = 60 * 1000; // 1 minute
const maxPerWindow = Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 30;
const store = new Map<string, { count: number; resetAt: number }>();

function getKey(identifier: string): string {
  return `rl:${identifier}`;
}

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = getKey(identifier);
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: maxPerWindow - 1 };
  }

  entry.count += 1;
  if (entry.count > maxPerWindow) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxPerWindow - entry.count };
}
