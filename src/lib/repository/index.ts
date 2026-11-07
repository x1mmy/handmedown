import "server-only";

import { dataAdapter } from "@/lib/config";
import { DemoRepository, getDemoRepository } from "@/lib/repository/demo";
import { SupabaseRepository } from "@/lib/repository/supabase";

export type AppRepository = DemoRepository | SupabaseRepository;

export function getRepository(): AppRepository {
  if (dataAdapter() === "supabase") return new SupabaseRepository();
  return getDemoRepository();
}

export { DemoRepository };
