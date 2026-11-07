import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabase(url: string, key: string): SupabaseClient {
  return createBrowserClient(url, key);
}
