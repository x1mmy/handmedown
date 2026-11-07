import { RecipeEditor } from "@/components/recipe-editor";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function NewRecipePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { book } = await loadBook(bookId);
  const kitchens = book.kitchens.filter((kitchen) => book.myKitchenIds.includes(kitchen.id));
  return (
    <main className="mx-auto w-full max-w-page px-4 py-6 desk:px-6">
      {kitchens.length === 0 ? (
        <p className="text-inksoft">Join a kitchen before filing a recipe into it.</p>
      ) : (
        <RecipeEditor bookId={bookId} bookTitle={book.title} kitchens={kitchens} />
      )}
    </main>
  );
}
