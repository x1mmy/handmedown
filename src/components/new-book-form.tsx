"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function NewBookForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kitchenName, setKitchenName] = useState("Our Kitchen");
  const [error, setError] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  useEffect(() => {
    const existing = sessionStorage.getItem("hmd-draft-key");
    if (existing) {
      setDraftKey(existing);
      return;
    }
    const key = crypto.randomUUID();
    sessionStorage.setItem("hmd-draft-key", key);
    setDraftKey(key);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftKey, title, kitchenName }),
    });
    const body = (await response.json()) as { message?: string; bookId?: string };
    if (!response.ok || !body.bookId) {
      setError(body.message ?? "Could not create the book");
      return;
    }
    sessionStorage.removeItem("hmd-draft-key");
    router.push(`/books/${body.bookId}`);
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6">
      <label className="micro" htmlFor="book-title">Book title</label>
      <input id="book-title" required value={title} onChange={(event) => setTitle(event.target.value)} className="mb-4 mt-1 w-full border-b border-ink bg-transparent py-2" />
      <label className="micro" htmlFor="kitchen-name">First kitchen</label>
      <input id="kitchen-name" required value={kitchenName} onChange={(event) => setKitchenName(event.target.value)} className="mt-1 w-full border-b border-ink bg-transparent py-2" />
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      <button type="submit" disabled={!draftKey} className="mt-6 inline-flex min-h-11 items-center border border-ink bg-ink px-5 text-[12px] uppercase tracking-[0.08em] text-sheet disabled:opacity-50">
        Create book
      </button>
    </form>
  );
}
