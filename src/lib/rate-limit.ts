const hits = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const LIMIT = 60;
const MAX_KEYS = 1000;

function prune(now: number): void {
  for (const [key, value] of hits) {
    if (value.resetAt <= now) hits.delete(key);
  }
  while (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
}

/** Fixed window. The map stays bounded so a spoofed key cannot grow it without limit. */
export function rateLimit(key: string, now = Date.now()): { ok: boolean; retryAfter: number } {
  if (hits.size > MAX_KEYS) prune(now);
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    if (hits.size >= MAX_KEYS) prune(now);
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (current.count >= LIMIT) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true, retryAfter: 0 };
}
