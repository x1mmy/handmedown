export default function LoadingBook() {
  return (
    <main className="mx-auto max-w-page px-4 py-6 desk:px-6" aria-busy="true" aria-live="polite">
      <p className="micro">Loading the book</p>
      <div className="mt-4 grid gap-4 desk:grid-cols-3">
        <div className="h-64 border border-rule bg-sheet" />
        <div className="h-64 border border-rule bg-sheet" />
        <div className="h-64 border border-rule bg-sheet" />
      </div>
    </main>
  );
}
