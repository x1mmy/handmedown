import "server-only";

import { notFound } from "next/navigation";

import { getPrincipal } from "@/lib/auth/principal";
import { sharedBookId } from "@/lib/book-scope";
import { AppError } from "@/lib/errors";
import { getRepository, type AppRepository } from "@/lib/repository";
import type { BookDetail, Principal } from "@/lib/types";

export async function loadContext(): Promise<{ principal: Principal; repo: AppRepository }> {
  return { principal: await getPrincipal(), repo: getRepository() };
}

/** The app holds one family book. */
export async function loadBook(bookId: string = sharedBookId()): Promise<{
  principal: Principal;
  repo: AppRepository;
  book: BookDetail;
}> {
  const { principal, repo } = await loadContext();
  try {
    const book = await repo.getBook(principal, bookId);
    return { principal, repo, book };
  } catch (error) {
    if (error instanceof AppError && (error.status === 404 || error.status === 403 || error.status === 401)) {
      notFound();
    }
    throw error;
  }
}
