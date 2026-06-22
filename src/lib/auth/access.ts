import { cookies } from "next/headers";
import {
  DEMO_MODE_COOKIE,
  DEMO_ORGANIZATION_ID,
  DEMO_ROLE_COOKIE,
  isDemoModeAllowed,
} from "@/lib/config";
import { AuthError, getAuthContext, type AuthContext } from "@/lib/auth/api";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { isUserRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

export interface AccessContext extends AuthContext {
  isDemoMode: boolean;
}

export async function isDemoSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isDemoModeAllowed() && cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";
}

async function getDemoRole(): Promise<UserRole> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_ROLE_COOKIE)?.value;
  if (raw && isUserRole(raw) && raw !== "platform_admin") {
    return raw;
  }
  return "founder";
}

export function requirePermission(access: AccessContext, permission: Permission): void {
  if (!hasPermission(access.role, permission)) {
    throw new AuthError("Forbidden", 403);
  }
}

export async function requireApiAccess(options?: {
  organizationId?: string | null;
}): Promise<AccessContext> {
  if (await isDemoSession()) {
    const requestedOrg = options?.organizationId ?? DEMO_ORGANIZATION_ID;
    if (requestedOrg !== DEMO_ORGANIZATION_ID) {
      throw new AuthError("Forbidden", 403);
    }

    return {
      userId: "demo",
      email: "demo@gcc.local",
      role: await getDemoRole(),
      organizationId: DEMO_ORGANIZATION_ID,
      isDemoMode: true,
    };
  }

  const auth = await getAuthContext();
  if (!auth) throw new AuthError("Unauthorized", 401);

  if (
    options?.organizationId &&
    options.organizationId !== auth.organizationId &&
    auth.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", 403);
  }

  return { ...auth, isDemoMode: false };
}

export async function requirePlatformAdminAccess(): Promise<AuthContext> {
  if (await isDemoSession()) {
    throw new AuthError("Forbidden", 403);
  }

  const auth = await getAuthContext();
  if (!auth) throw new AuthError("Unauthorized", 401);

  if (auth.role !== "platform_admin") {
    throw new AuthError("Forbidden", 403);
  }

  return auth;
}
