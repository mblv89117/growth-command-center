import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseUrl } from "@/lib/supabase/url";

export function createClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = getSupabaseUrl();
  if (!url) return null;

  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
