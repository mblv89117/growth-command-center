import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseUrl } from "@/lib/supabase/url";

export function createAdminClient() {
  if (!isSupabaseConfigured()) return null;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey.startsWith("your-") || serviceKey === process.env.QUICKBOOKS_CLIENT_ID) {
    return null;
  }

  const url = getSupabaseUrl();
  if (!url) return null;

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
