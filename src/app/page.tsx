import Link from "next/link";
import { redirect } from "next/navigation";

import { lineClass, solidClass } from "@/components/chrome";
import { loadContext } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { principal, repo } = await loadContext();
  const books = await repo.listMyBooks(principal);
  const own = books.filter((book) => !book.isExample);
  const example = books.find((book) => book.isExample);
  if (own.length === 0 && example) redirect(`/books/${example.id}`);

  return (
    <main className="mx-auto max-w-page px-4 py-10 desk:px-6">
      <p className="micro text-accent">Hand Me Down</p>
      <h1 className="mt-2 font-serif text-4xl font-normal tracking-[-0.02em]">Your family books</h1>
      <ul className="mt-8 divide-y divide-rule border-y border-rule">
        {books.map((book) => (
          <li key={book.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
            <div>
              <Link href={`/books/${book.id}`} className="font-serif text-2xl">
                {book.title}
              </Link>
              <p className="micro mt-1">
                {book.isExample ? "Example" : book.access} · {book.recipeCount} recipes
              </p>
            </div>
            <Link href={`/books/${book.id}`} className={lineClass()}>
              Open
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/books/new" className={solidClass()}>
          Start a book
        </Link>
        {!principal.userId ? (
          <Link href="/sign-in?next=/books/new" className={lineClass()}>
            Sign in
          </Link>
        ) : null}
      </div>
    </main>
  );
}
