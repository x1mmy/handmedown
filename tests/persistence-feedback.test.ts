import { describe, expect, it } from "vitest";

import { UNDO_WINDOW_MS } from "@/lib/constants";
import { resolveCookedUpdate, undoToastRemaining } from "@/lib/persistence-feedback";

describe("persistence stays independent of motion", () => {
  it("times the undo window from the server delete instant", () => {
    const deletedAt = 10_000;
    expect(undoToastRemaining(deletedAt, deletedAt)).toBe(UNDO_WINDOW_MS);
    expect(undoToastRemaining(deletedAt, deletedAt + 1_500)).toBe(UNDO_WINDOW_MS - 1_500);
    expect(undoToastRemaining(deletedAt, deletedAt + UNDO_WINDOW_MS + 1)).toBe(0);
  });

  it("keeps a cooked stamp only when the server applied the write", () => {
    expect(resolveCookedUpdate(35, true)).toEqual({ count: 35, stamped: true });
    expect(resolveCookedUpdate(34, false)).toEqual({ count: 34, stamped: false });
  });
});
