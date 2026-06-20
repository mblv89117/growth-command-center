import { cookies } from "next/headers";
import { DEMO_MODE_COOKIE, isDemoModeAllowed } from "@/lib/config";
import { AuthError, getAuthContext, type AuthContext } from "@/lib/auth/api";

export interface AccessContext extends AuthContext {
  isDemoMode: boolean;
}

export async function isDemoSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isDemoModeAllowed() && cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";
}

export async function requireApiAccess(options?: {
  organizationId?: string | null;
}): Promise<AccessContext> {
  if (await isDemoSession()) {
    return {
      userId: "demo",
      email: "demo@gcc.local",
      role: "founder",
      organizationId: options?.organizationId ?? "org-apex",
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
