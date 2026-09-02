/**
 * Normalize Supabase project URL for createClient / PostgREST / Auth Admin.
 * Strips trailing slashes and accidental /rest/v1 or /auth/v1 suffixes that
 * cause Kong "Invalid path specified in request URL" on Auth Admin calls.
 * Does not log or return secret values.
 */
export function normalizeSupabaseUrl(raw, { requireSupabaseHost = true } = {}) {
  if (raw == null || String(raw).trim() === "") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is empty");
  }

  let url = String(raw).trim().replace(/^["']|["']$/g, "");

  // Reject accidental database / pooler URLs without leaking credentials.
  if (/^postgres(ql)?:\/\//i.test(url)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL looks like a Postgres connection string; use the Project URL (https://<ref>.supabase.co)"
    );
  }

  try {
    // Ensure URL parser accepts the value
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
  }

  url = url.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1$/i, "");
  url = url.replace(/\/auth\/v1$/i, "");
  url = url.replace(/\/+$/, "");

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  if (requireSupabaseHost) {
    const ok =
      host.endsWith(".supabase.co") ||
      host.endsWith(".supabase.in") ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (!ok) {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_URL host must be *.supabase.co (got host=${host})`
      );
    }
  }

  if (parsed.pathname && parsed.pathname !== "/") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must not include a path (got path=${parsed.pathname})`
    );
  }

  return `${parsed.protocol}//${parsed.host}`;
}

export function describeSupabaseUrl(raw) {
  try {
    const normalized = normalizeSupabaseUrl(raw, { requireSupabaseHost: false });
    const u = new URL(normalized);
    return { ok: true, host: u.host, protocol: u.protocol.replace(":", "") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function describeKeyKind(key) {
  if (!key) return "missing";
  if (key.startsWith("eyJ")) return "jwt";
  if (key.startsWith("sb_publishable_")) return "sb_publishable";
  if (key.startsWith("sb_secret_")) return "sb_secret";
  if (key.startsWith("sbp_")) return "management_access_token";
  return "unknown";
}
