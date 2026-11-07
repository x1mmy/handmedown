import { AppError } from "@/lib/errors";

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

/** Chromium is not available on Vercel serverless. The print preview stays usable. */
export function pdfExportEnabled(): boolean {
  return process.env.VERCEL !== "1" && process.env.HMD_PDF_EXPORT !== "off";
}

export function assertSupabaseConfigured(): { url: string; publishableKey: string; secretKey: string } {
  const pub = supabasePublicEnv();
  const secretKey = supabaseSecretKey();
  if (!pub || !secretKey) {
    throw new AppError(
      500,
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in .env.",
    );
  }
  return { url: pub.url, publishableKey: pub.key, secretKey };
}
