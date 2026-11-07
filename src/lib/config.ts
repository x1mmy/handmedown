export type DataAdapterName = "demo" | "supabase";

export function dataAdapter(): DataAdapterName {
  return process.env.HMD_DATA_ADAPTER === "supabase" ? "supabase" : "demo";
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
