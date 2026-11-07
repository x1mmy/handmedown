import { notFound } from "next/navigation";

import { CookSheet } from "@/components/cook-sheet";
import { AppError } from "@/lib/errors";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
  const { repo, principal, book } = await loadBook();
  try {
    const recipe = await repo.getRecipe(principal, book.id, recipeId);
    return (
      <main>
        <CookSheet recipe={recipe} />
      </main>
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
