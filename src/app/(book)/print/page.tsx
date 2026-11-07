import { Screen, ScreenHeader } from "@/components/app/screen";
import { PrintStudio } from "@/components/print-studio";
import { pdfExportEnabled } from "@/lib/config";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function PrintPage() {
  const { repo, principal, book } = await loadBook();
  const snapshot = await repo.buildPreviewSnapshot(principal, book.id, "olive", false);
  return (
    <Screen>
      <ScreenHeader title="Print" />
      <p className="px-4 pt-1 text-body-regular text-text-secondary lg:px-0">Turn the book into an A5 copy for the shelf.</p>
      <PrintStudio bookId={book.id} snapshot={snapshot} pdfEnabled={pdfExportEnabled()} />
    </Screen>
  );
}
