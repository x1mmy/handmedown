import "server-only";

import { assertSupabaseConfigured } from "@/lib/config";
import { SupabaseRepository } from "@/lib/repository/supabase";

export type AppRepository = SupabaseRepository;

/** Supabase is the only store. Missing config fails loudly. */
export function getRepository(): AppRepository {
  assertSupabaseConfigured();
  return new SupabaseRepository();
}
