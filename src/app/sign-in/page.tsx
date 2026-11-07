import { DemoSignIn, MagicLinkForm } from "@/components/auth-forms";
import { dataAdapter, supabasePublicEnv } from "@/lib/config";
import { safeNextPath } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  const next = safeNextPath(query.next, "/");
  const adapter = dataAdapter();
  const supabase = supabasePublicEnv();

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <p className="micro text-accent">Household sign in</p>
      <h1 className="mt-2 font-serif text-4xl font-normal">Open your book</h1>
      {adapter === "supabase" && supabase ? (
        <MagicLinkForm url={supabase.url} publishableKey={supabase.key} nextPath={next} />
      ) : (
        <>
          <p className="mt-3 text-inksoft">
            This machine is using the local demo book. Enter an email to sign in here. A real magic link is sent when
            HMD_DATA_ADAPTER=supabase.
          </p>
          <DemoSignIn nextPath={next} />
        </>
      )}
    </main>
  );
}
