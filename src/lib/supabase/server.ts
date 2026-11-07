import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabasePublicEnv, supabaseSecretKey } from "@/lib/config";
import { AppError } from "@/lib/errors";

export async function createUserClient(): Promise<SupabaseClient> {
  const env = supabasePublicEnv();
  if (!env) throw new AppError(400, "Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2] }[]) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes the session.
        }
      },
    },
  });
}

export function createServiceClient(): SupabaseClient {
  const env = supabasePublicEnv();
  const secret = supabaseSecretKey();
  if (!env || !secret) {
    throw new AppError(400, "SUPABASE_SECRET_KEY is not set");
  }
  return createClient(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
