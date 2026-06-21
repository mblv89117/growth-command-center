import { getAppUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendTeamInvite(options: {
  organizationId: string;
  email: string;
  role: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Team invitations require a configured Supabase service role key.",
    };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(options.email, {
    data: {
      organization_id: options.organizationId,
      role: options.role,
    },
    redirectTo: `${getAppUrl()}/auth/callback`,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
