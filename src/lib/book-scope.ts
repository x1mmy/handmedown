import { AppError } from "@/lib/errors";

/** Seeded by the migration as "The Fam". */
export const DEFAULT_BOOK_ID = "10000000-0000-4000-8000-000000000001";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The one book this server will read or write. Set HMD_BOOK_ID to override the seeded id. */
export function sharedBookId(): string {
  const raw = process.env.HMD_BOOK_ID?.trim();
  if (!raw) return DEFAULT_BOOK_ID;
  if (!UUID.test(raw)) throw new AppError(500, "HMD_BOOK_ID must be a UUID");
  return raw.toLowerCase();
}

export function assertSharedBook(bookId: string): string {
  const id = bookId.trim().toLowerCase();
  if (!UUID.test(id) || id !== sharedBookId()) throw new AppError(404, "Book not found");
  return id;
}
