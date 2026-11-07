import { AppError } from "@/lib/errors";

export type DataAdapterName = "demo" | "supabase";

const ADAPTERS: readonly DataAdapterName[] = ["demo", "supabase"];

/**
 * Demo is an explicit local opt-in. Anything else is Supabase, which must be
 * fully configured or the process fails. There is no silent demo fallback.
 */
export function dataAdapter(): DataAdapterName {
  const raw = process.env.HMD_DATA_ADAPTER;
  if (raw === undefined || raw === "") return "supabase";
  if ((ADAPTERS as readonly string[]).includes(raw)) return raw as DataAdapterName;
  throw new AppError(500, `HMD_DATA_ADAPTER must be "demo" or "supabase" (got ${JSON.stringify(raw)})`);
}

export function supabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function supabaseSecretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  return key && key.length > 0 ? key : null;
}

export function assertSupabaseConfigured(): { url: string; publishableKey: string; secretKey: string } {
  const pub = supabasePublicEnv();
  const secretKey = supabaseSecretKey();
  if (!pub || !secretKey) {
    throw new AppError(
      500,
      "Supabase mode is misconfigured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY. There is no demo fallback.",
    );
  }
  return { url: pub.url, publishableKey: pub.key, secretKey };
}
