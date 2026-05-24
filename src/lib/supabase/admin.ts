import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";

export function createAdminClient() {
  if (!isSupabaseConfigured()) return null;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey.startsWith("your-") || serviceKey === process.env.QUICKBOOKS_CLIENT_ID) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
