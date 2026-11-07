import { RiHome5Line } from "@remixicon/react";

import { Screen, ScreenHeader } from "@/components/app/screen";
import { ButtonLink } from "@/components/base/buttons/button";
import { RecipeEditor } from "@/components/recipe-editor";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const { book } = await loadBook();
  const kitchens = book.kitchens.filter((kitchen) => book.myKitchenIds.includes(kitchen.id));
  if (kitchens.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="New recipe" />
        <div className="mx-4 mt-4 rounded-3xl bg-background-primary-default px-6 py-12 text-center shadow-card lg:mx-0">
          <p className="text-title-3-semibold text-text-primary">Add a kitchen first</p>
          <p className="mt-1 text-body-regular text-text-secondary">Every recipe is filed under the kitchen it comes from.</p>
          <ButtonLink href="/kitchens" leadingIcon={RiHome5Line} className="mt-5 h-11 rounded-full px-5">
            Go to kitchens
          </ButtonLink>
        </div>
      </Screen>
    );
  }
  return (
    <main>
      <RecipeEditor bookId={book.id} bookTitle={book.title} kitchens={kitchens} />
    </main>
  );
}
