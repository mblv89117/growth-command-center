import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metadata = user.user_metadata ?? {};
  let organizationId = (metadata.organization_id as string) ?? "org-apex";
  let role = (metadata.role as UserRole) ?? "founder";

  const admin = createAdminClient();
  if (admin) {
    const { data: profile } = await admin
      .from("gcc_profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.organization_id) organizationId = profile.organization_id;
    if (profile?.role) role = profile.role as UserRole;
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    role,
    organizationId,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError("Unauthorized", 401);
  return ctx;
}

export async function requireRole(allowed: UserRole[]): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!allowed.includes(ctx.role) && ctx.role !== "founder" && ctx.role !== "platform_admin") {
    throw new AuthError("Forbidden", 403);
  }
  return ctx;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
