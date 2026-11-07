"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { BookDetail } from "@/lib/types";

const NAV = [
  { suffix: "", label: "Recipes" },
  { suffix: "/album", label: "Album" },
  { suffix: "/kitchens", label: "Kitchens" },
  { suffix: "/print", label: "Print" },
] as const;

export function BookNav({ bookId }: { bookId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary sections" className="flex flex-wrap gap-x-4 gap-y-1 py-2 desk:gap-x-6">
      {NAV.map((item) => {
        const href = `/books/${bookId}${item.suffix}`;
        const active = item.suffix === "" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={item.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center text-[12px] uppercase tracking-[0.08em] ${
              active ? "border-b-[1.5px] border-accent font-semibold text-ink" : "text-inkmuted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TitleInput({ bookId, title }: { bookId: string; title: string }) {
  const router = useRouter();
  return (
    <input
      key={title}
      aria-label="Book title"
      defaultValue={title}
      className="w-full min-w-[12rem] max-w-full border-b border-dashed border-transparent bg-transparent font-serif text-[26px] leading-none tracking-[-0.02em] outline-none focus:border-accent desk:text-[34px]"
      onBlur={async (event) => {
        const next = event.currentTarget.value.trim();
        if (!next || next === title) return;
        const response = await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: next }),
        });
        if (response.ok) router.refresh();
      }}
    />
  );
}

export function KitchenSwitcher({
  book,
  kitchenId,
}: {
  book: BookDetail;
  kitchenId?: string;
}) {
  return (
    <form action={`/books/${book.id}`} className="inline-flex min-h-11 items-center gap-2 border border-rule bg-sheet px-2.5">
      <label className="micro" htmlFor="kitchen-switch">
        Cooking as
      </label>
      <select
        id="kitchen-switch"
        name="kitchen"
        aria-label="Cooking as kitchen"
        defaultValue={kitchenId ?? ""}
        className="max-w-[11rem] bg-transparent font-medium outline-none"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="">All kitchens</option>
        {book.kitchens.map((kitchen) => (
          <option key={kitchen.id} value={kitchen.id}>
            {kitchen.name}
          </option>
        ))}
      </select>
    </form>
  );
}
