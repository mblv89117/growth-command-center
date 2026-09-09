/**
 * Pure helpers for platform_admin route gating (testable without Supabase SSR).
 */

export function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === "platform_admin";
}

export interface AdminRouteAccessInput {
  isAdminRoute: boolean;
  demoMode: boolean;
  role: string | null | undefined;
}

export interface AdminRouteAccessResult {
  allowed: boolean;
  redirectPath?: string;
}

/**
 * Fail closed on admin routes unless role is platform_admin.
 * Demo mode is never allowed on /admin.
 */
export function evaluateAdminRouteAccess(input: AdminRouteAccessInput): AdminRouteAccessResult {
  if (!input.isAdminRoute) {
    return { allowed: true };
  }

  if (input.demoMode) {
    return { allowed: false, redirectPath: "/dashboard" };
  }

  if (!isPlatformAdminRole(input.role)) {
    return { allowed: false, redirectPath: "/dashboard" };
  }

  return { allowed: true };
}
