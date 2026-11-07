import { AppError } from "@/lib/errors";

const COOLDOWN_MS = 20_000;
const lastByIp = new Map<string, number>();
let running = 0;

function prune(now: number): void {
  for (const [ip, at] of lastByIp) {
    if (now - at > COOLDOWN_MS * 4) lastByIp.delete(ip);
  }
  while (lastByIp.size > 500) {
    const oldest = lastByIp.keys().next().value;
    if (oldest === undefined) break;
    lastByIp.delete(oldest);
  }
}

/** One PDF at a time, and a short cooldown per address. */
export function beginExport(ip: string, now = Date.now()): () => void {
  prune(now);
  if (running >= 1) throw new AppError(429, "A PDF is already rendering");
  const previous = lastByIp.get(ip) ?? 0;
  if (now - previous < COOLDOWN_MS) throw new AppError(429, "Wait a moment before another PDF");
  running += 1;
  lastByIp.set(ip, now);
  return () => {
    running = Math.max(0, running - 1);
  };
}
