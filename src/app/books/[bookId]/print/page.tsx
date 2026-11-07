import { PrintStudio } from "@/components/print-studio";
import { pdfExportEnabled } from "@/lib/config";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { repo, principal } = await loadBook(bookId);
  const snapshot = await repo.buildPreviewSnapshot(principal, bookId, "olive", false);
  return (
    <main className="mx-auto w-full max-w-page px-4 py-6 desk:px-6">
      <PrintStudio bookId={bookId} snapshot={snapshot} pdfEnabled={pdfExportEnabled()} />
    </main>
  );
}
