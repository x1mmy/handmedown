import { UNDO_WINDOW_MS } from "@/lib/constants";

/** How long the undo control stays up. Comes from the server delete time, not from an animation. */
export function undoToastRemaining(deletedAt: number, now: number, windowMs = UNDO_WINDOW_MS): number {
  if (!Number.isFinite(deletedAt) || !Number.isFinite(now)) return 0;
  return Math.max(0, deletedAt + windowMs - now);
}

export type CookedResolution = {
  count: number;
  stamped: boolean;
};

/**
 * The optimistic count is previous + 1. After the server answers, the visible
 * count is the server value. A replay or a failed write does not keep the stamp.
 */
export function resolveCookedUpdate(serverCount: number, applied: boolean): CookedResolution {
  return { count: serverCount, stamped: applied };
}
