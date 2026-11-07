/**
 * Single source for the Stash Labs credit link.
 * Confirmed by the owner (Zimraan Anjum).
 */
export const STASH_LABS_URL = "https://www.stashlabs.com.au/";

export const FOOTER_TEXT = "Built by Stash Labs";

/** Soft-delete undo window. */
export const UNDO_WINDOW_MS = 6_000;

export const DEFAULT_BOOK_NAME = "The Fam";

export function normalizeBookName(raw: string): string {
  const trimmed = raw.trim().slice(0, 40);
  return trimmed || DEFAULT_BOOK_NAME;
}

export const MAX_UPLOAD_BYTES = 10_000_000;
