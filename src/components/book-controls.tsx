"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
            className={`inline-flex min-h-11 min-w-11 items-center justify-center text-[12px] uppercase tracking-[0.08em] ${
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
  return (
    <InlineName
      value={title}
      label="Book title"
      displayClass="font-serif text-[26px] leading-none tracking-[-0.02em] desk:text-[34px]"
      save={async (next) => {
        const response = await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: next }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message || "Could not rename the book");
        }
      }}
    />
  );
}

export function InlineName({
  value,
  label,
  save,
  displayClass,
}: {
  value: string;
  label: string;
  displayClass: string;
  save: (next: string) => Promise<void>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    const next = draft.trim().slice(0, 40) || "The Fam";
    setDraft(next);
    if (next === value) {
      setEditing(false);
      return;
    }
    try {
      await save(next);
      setNotice("Saved");
      setError(null);
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setNotice(null);
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex min-w-0 flex-wrap items-baseline gap-2">
        <button type="button" className={`min-h-11 min-w-0 max-w-full truncate text-left ${displayClass}`} onClick={() => { setNotice(null); setEditing(true); }}>
          {value}
        </button>
        {notice ? <span role="status" className="text-sm font-sans">Saved</span> : null}
        {error ? <span role="alert" className="text-sm font-sans text-accent">{error}</span> : null}
      </span>
    );
  }

  return (
    <input
      autoFocus
      aria-label={label}
      maxLength={40}
      value={draft}
      className={`min-h-11 w-full min-w-[12rem] max-w-full border-b border-ink bg-transparent py-2 text-base leading-normal focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${displayClass}`}
      onChange={(event) => setDraft(event.target.value.slice(0, 40))}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(value);
          setEditing(false);
        }
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
        className="min-h-11 max-w-[11rem] bg-transparent text-base font-medium"
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
