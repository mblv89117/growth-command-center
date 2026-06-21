export const isProduction = process.env.NODE_ENV === "production";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isQuickBooksConfigured(): boolean {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID &&
      process.env.QUICKBOOKS_CLIENT_SECRET &&
      process.env.QUICKBOOKS_REDIRECT_URI
  );
}

/** Demo mode is development-only unless explicitly enabled */
export function isDemoModeAllowed(): boolean {
  if (!isProduction) return true;
  return process.env.ALLOW_DEMO_MODE === "true";
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export const DEMO_MODE_COOKIE = "gcc_demo_mode";

/** Demo sessions are pinned to this organization only */
export const DEMO_ORGANIZATION_ID = "org-apex";

export const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback"];

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/cash-forecast",
  "/financials",
  "/sales-pipeline",
  "/operations",
  "/reports",
  "/scenarios",
  "/alerts",
  "/integrations",
  "/team",
  "/settings",
  "/onboarding",
  "/admin",
];

export const ADMIN_ROUTES = ["/admin"];

export const PUBLIC_API_ROUTES = [
  "/api/health",
  "/api/auth/demo",
  "/auth/callback",
  "/api/integrations/quickbooks/callback",
  "/api/billing/webhook",
];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

export function validateProductionEnv(): string[] {
  const missing: string[] = [];
  if (!isProduction) return missing;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.NEXT_PUBLIC_APP_URL) missing.push("NEXT_PUBLIC_APP_URL");

  return missing;
}
