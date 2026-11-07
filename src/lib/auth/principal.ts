import "server-only";

import { dataAdapter } from "@/lib/config";
import type { Principal } from "@/lib/types";

/**
 * There is no login. The demo cookie is ignored. Supabase mode uses the
 * server secret and does not accept a browser session as authority.
 */
export async function getPrincipal(): Promise<Principal> {
  dataAdapter();
  return { userId: null, preview: true };
}
