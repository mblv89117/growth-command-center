import { isEntraAuthEnabled } from "@/lib/auth/entra/config";

/** Supabase Bearer JWT validation is disabled when Entra is the sole auth provider. */
export function isSupabaseBearerAuthAllowed(): boolean {
  return !isEntraAuthEnabled();
}
