import { notFound } from "next/navigation";

import { RecipeEditor } from "@/components/recipe-editor";
import { AppError } from "@/lib/errors";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
  const { repo, principal, book } = await loadBook();
  try {
    const recipe = await repo.getRecipe(principal, book.id, recipeId);
    if (!recipe.canEdit) notFound();
    const kitchens = book.kitchens.filter((kitchen) => book.myKitchenIds.includes(kitchen.id));
    return (
      <main>
        <RecipeEditor bookId={book.id} bookTitle={book.title} kitchens={kitchens} recipe={recipe} />
      </main>
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
