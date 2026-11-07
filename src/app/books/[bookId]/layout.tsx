import type { Metadata } from "next";

import { ExampleStrip, Masthead } from "@/components/chrome";
import { PageTurn } from "@/components/motion";
import { DEFAULT_BOOK_NAME } from "@/lib/constants";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ bookId: string }> }): Promise<Metadata> {
  const { bookId } = await params;
  try {
    const { book } = await loadBook(bookId);
    return { title: book.title || DEFAULT_BOOK_NAME };
  } catch {
    return { title: DEFAULT_BOOK_NAME };
  }
}

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const { book } = await loadBook(bookId);
  return (
    <>
      {book.isExample ? <ExampleStrip /> : null}
      <Masthead book={book} />
      <PageTurn>{children}</PageTurn>
    </>
  );
}
