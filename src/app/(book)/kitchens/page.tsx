import { Screen, ScreenHeader } from "@/components/app/screen";
import { KitchenManager } from "@/components/kitchen-manager";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function KitchensPage() {
  const { repo, principal, book } = await loadBook();
  const desk = await repo.listKitchens(principal, book.id);
  return (
    <Screen>
      <ScreenHeader title="Kitchens" />
      <p className="px-4 pt-1 text-body-regular text-text-secondary lg:px-0 lg:text-headline-regular">Each household keeps its own kitchen. Tap a name to rename it.</p>
      <KitchenManager bookId={book.id} desk={desk} />
    </Screen>
  );
}
