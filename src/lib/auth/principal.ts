import "server-only";

import type { Principal } from "@/lib/types";

/**
 * There is no login. Everyone with the link is family. The server talks to
 * Supabase with its secret key and never trusts a browser session.
 */
export async function getPrincipal(): Promise<Principal> {
  return { userId: null, preview: true };
}
