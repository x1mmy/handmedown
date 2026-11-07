import "server-only";

import { cookies } from "next/headers";

import { dataAdapter } from "@/lib/config";
import type { Principal } from "@/lib/types";
import { createUserClient } from "@/lib/supabase/server";

export async function getPrincipal(): Promise<Principal> {
  if (dataAdapter() === "supabase") {
    const supabase = await createUserClient();
    const { data } = await supabase.auth.getUser();
    return { userId: data.user?.id ?? null, preview: !data.user };
  }
  const jar = await cookies();
  const userId = jar.get("hmd_demo_uid")?.value ?? null;
  return { userId, preview: !userId };
}
