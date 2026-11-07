import { CookSheet } from "@/components/cook-sheet";
import { AppError } from "@/lib/errors";
import { loadBook } from "@/server/load";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ bookId: string; recipeId: string }>;
}) {
  const { bookId, recipeId } = await params;
  const { repo, principal } = await loadBook(bookId);
  try {
    const recipe = await repo.getRecipe(principal, bookId, recipeId);
    return (
      <main className="mx-auto w-full max-w-page px-4 py-6 desk:px-6">
        <CookSheet recipe={recipe} />
      </main>
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
