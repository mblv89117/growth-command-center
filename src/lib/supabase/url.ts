/**
 * Normalize NEXT_PUBLIC_SUPABASE_URL for createClient.
 * Strips trailing slashes and accidental /rest/v1|/auth/v1 suffixes.
 */
export function normalizeSupabaseUrl(raw: string): string {
  let url = raw.trim().replace(/^["']|["']$/g, "");
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is empty");
  }
  if (/^postgres(ql)?:\/\//i.test(url)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL looks like a Postgres connection string; use https://<ref>.supabase.co"
    );
  }
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1$/i, "");
  url = url.replace(/\/auth\/v1$/i, "");
  url = url.replace(/\/+$/, "");
  const parsed = new URL(url);
  if (parsed.pathname && parsed.pathname !== "/") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must not include a path (got ${parsed.pathname})`
    );
  }
  return `${parsed.protocol}//${parsed.host}`;
}

export function getSupabaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return normalizeSupabaseUrl(raw);
  } catch {
    return null;
  }
}
