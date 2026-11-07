import { redirect } from "next/navigation";

import { NewBookForm } from "@/components/new-book-form";
import { loadContext } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const { principal } = await loadContext();
  if (!principal.userId) redirect("/sign-in?next=/books/new");
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <p className="micro">New book</p>
      <h1 className="mt-2 font-serif text-4xl font-normal">Start a family book</h1>
      <p className="mt-3 text-inksoft">You become the owner. The first kitchen is yours. Invited family start as readers.</p>
      <NewBookForm />
    </main>
  );
}
