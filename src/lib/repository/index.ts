import "server-only";

import { assertSupabaseConfigured, dataAdapter } from "@/lib/config";
import { DemoRepository, getDemoRepository } from "@/lib/repository/demo";
import { SupabaseRepository } from "@/lib/repository/supabase";

export type AppRepository = DemoRepository | SupabaseRepository;

export function getRepository(): AppRepository {
  if (dataAdapter() === "demo") return getDemoRepository();
  assertSupabaseConfigured();
  return new SupabaseRepository();
}

export { DemoRepository };
