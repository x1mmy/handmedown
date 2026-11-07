"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteRedeem({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    const response = await fetch("/api/invites/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = (await response.json()) as { message?: string; bookId?: string };
    if (!response.ok || !body.bookId) {
      setError(body.message ?? "This invite could not be used");
      return;
    }
    router.push(`/books/${body.bookId}`);
    router.refresh();
  }

  return (
    <div className="mt-6">
      {error ? <p className="mb-3 text-sm text-accent">{error}</p> : null}
      <button type="button" onClick={() => void accept()} className="inline-flex min-h-11 items-center border border-ink bg-ink px-5 text-[12px] uppercase tracking-[0.08em] text-sheet">
        Accept invite
      </button>
    </div>
  );
}
