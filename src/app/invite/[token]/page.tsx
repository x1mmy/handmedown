import { redirect } from "next/navigation";

import { InviteRedeem } from "@/components/invite-redeem";
import { loadContext } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { principal } = await loadContext();
  if (!principal.userId) redirect(`/sign-in?next=/invite/${encodeURIComponent(token)}`);
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <p className="micro">Family invite</p>
      <h1 className="mt-2 font-serif text-4xl font-normal">Join this book as a reader</h1>
      <p className="mt-3 text-inksoft">
        Accepting lets you read the book. A kitchen still has to approve you before you can edit its recipes.
      </p>
      <InviteRedeem token={token} />
    </main>
  );
}
