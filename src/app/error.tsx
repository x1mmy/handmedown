"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="micro text-accent">Something went wrong</p>
      <h1 className="mt-2 font-serif text-4xl font-normal">The page could not be opened</h1>
      <p className="mt-3 text-inksoft">{error.message || "Please try again."}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex min-h-11 items-center border border-ink bg-ink px-5 text-[12px] font-medium uppercase tracking-[0.08em] text-sheet"
      >
        Retry
      </button>
    </main>
  );
}
