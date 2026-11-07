import { ExampleStrip, Masthead } from "@/components/chrome";
import { PageTurn } from "@/components/motion";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

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
