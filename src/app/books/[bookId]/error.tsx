"use client";

export default function BookError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-serif text-3xl font-normal">This book could not be opened</h1>
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
