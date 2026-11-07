import { KitchenManager } from "@/components/kitchen-manager";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function KitchensPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { repo, principal } = await loadBook(bookId);
  const desk = await repo.listKitchens(principal, bookId);
  return (
    <main className="mx-auto w-full max-w-page px-4 py-6 desk:px-6">
      <p className="micro">Households</p>
      <h2 className="mb-5 font-serif text-3xl font-normal">Kitchens</h2>
      <KitchenManager bookId={bookId} desk={desk} />
    </main>
  );
}
