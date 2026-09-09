/**
 * Pure helpers for middleware session gating (testable without Supabase URL).
 */
export type AuthProviderMode = "supabase" | "entra";

export interface SessionGateCookie {
  name: string;
  value: string;
}

export function isLikelyAuthSessionCookieName(cookieName: string): boolean {
  const name = cookieName.toLowerCase();
  return (
    name.includes("auth-token") ||
    name.includes("access-token") ||
    name === "gcc_entra_session"
  );
}

/** Entra mode must not require Supabase SSR for protected-route session checks. */
export function shouldUseSupabaseSessionGate(authProvider: AuthProviderMode): boolean {
  return authProvider !== "entra";
}

/**
 * Returns true when Entra sealed cookie (or demo/likely auth cookie) satisfies the gate.
 * Does not call Supabase.
 */
export function isEntraSessionGateSatisfied(
  cookies: SessionGateCookie[],
  options: {
    entraSessionCookieName: string;
    demoModeAllowed: boolean;
    demoModeCookieName: string;
  }
): boolean {
  if (cookies.some((cookie) => isLikelyAuthSessionCookieName(cookie.name))) {
    return true;
  }

  if (cookies.some((c) => c.name === options.entraSessionCookieName && c.value)) {
    return true;
  }

  return (
    options.demoModeAllowed &&
    cookies.some((c) => c.name === options.demoModeCookieName && c.value === "1")
  );
}
