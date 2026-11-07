const hits = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const LIMIT = 60;

/** Basic fixed window. Enough to slow a hot loop, not a product feature. */
export function rateLimit(key: string, now = Date.now()): { ok: boolean; retryAfter: number } {
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (current.count >= LIMIT) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true, retryAfter: 0 };
}
