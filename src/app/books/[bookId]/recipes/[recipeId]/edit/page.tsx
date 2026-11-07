import { notFound } from "next/navigation";

import { RecipeEditor } from "@/components/recipe-editor";
import { AppError } from "@/lib/errors";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ bookId: string; recipeId: string }>;
}) {
  const { bookId, recipeId } = await params;
  const { repo, principal, book } = await loadBook(bookId);
  try {
    const recipe = await repo.getRecipe(principal, bookId, recipeId);
    if (!recipe.canEdit) notFound();
    const kitchens = book.kitchens.filter((kitchen) => book.myKitchenIds.includes(kitchen.id));
    return (
      <main className="mx-auto w-full max-w-page px-4 py-6 desk:px-6">
        <RecipeEditor bookId={bookId} bookTitle={book.title} kitchens={kitchens} recipe={recipe} />
      </main>
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
