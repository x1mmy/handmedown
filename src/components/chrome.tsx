import Link from "next/link";

import type { BookDetail } from "@/lib/types";

import { BookNav, KitchenSwitcher, TitleInput } from "@/components/book-controls";

export function ExampleStrip() {
  return (
    <div className="border-b border-rule bg-paperwarm px-4 py-2 text-[13px] text-inksoft desk:px-6">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3">
        <span>Viewing the example family book</span>
        <Link href="/" className="inline-flex min-h-11 items-center border-b border-ink pb-px text-[12px] font-semibold uppercase tracking-[0.05em] text-ink">
          Open the book
        </Link>
      </div>
    </div>
  );
}

export function Masthead({ book, kitchenId }: { book: BookDetail; kitchenId?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur-[6px]">
      <div className="mx-auto max-w-page px-4 pt-3 desk:px-6 desk:pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-3">
            <TitleField book={book} />
            <span className="micro">
              {book.kitchenCount} {book.kitchenCount === 1 ? "Kitchen" : "Kitchens"} · {book.recipeCount}{" "}
              {book.recipeCount === 1 ? "Recipe" : "Recipes"}
            </span>
          </div>
          <KitchenSwitcher book={book} kitchenId={kitchenId} />
        </div>
        <BookNav bookId={book.id} />
      </div>
    </header>
  );
}

function TitleField({ book }: { book: BookDetail }) {
  if (!book.canEditTitle) {
    return <h1 className="font-serif text-[26px] leading-none tracking-[-0.02em] desk:text-[34px]">{book.title}</h1>;
  }
  return (
    <h1 className="min-w-0 font-serif text-[26px] leading-none tracking-[-0.02em] desk:text-[34px]">
      <TitleInput bookId={book.id} title={book.title} />
    </h1>
  );
}

export function solidClass(extra = "") {
  return `press inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-5 text-center text-[12px] font-medium uppercase tracking-[0.08em] text-sheet ${extra}`;
}

export function lineClass(extra = "") {
  return `press inline-flex min-h-11 items-center justify-center border border-ink bg-transparent px-4 text-center text-[12px] font-medium uppercase tracking-[0.08em] text-ink ${extra}`;
}
