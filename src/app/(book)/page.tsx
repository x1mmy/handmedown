import { HomeScreen } from "@/components/home-screen";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ q?: string; kitchen?: string }> }) {
  const query = await searchParams;
  const { repo, principal, book } = await loadBook();
  const kitchen = book.kitchens.find((item) => item.id === query.kitchen);
  const q = query.q?.trim().slice(0, 80) || undefined;
  const recipes = await repo.listRecipes(principal, book.id, { course: "all", kitchenId: kitchen?.id });
  const results = q ? await repo.listRecipes(principal, book.id, { course: "all", query: q, kitchenId: kitchen?.id }) : null;
  return (
    <HomeScreen
      book={{ id: book.id, title: book.title, canEditTitle: book.canEditTitle, recipeCount: book.recipeCount }}
      recipes={recipes}
      results={results}
      query={q ?? ""}
      kitchen={kitchen ?? null}
    />
  );
}
