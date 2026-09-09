import { randomBytes } from "crypto";
import { getAppUrl } from "@/lib/config";
import { isEntraAuthEnabled } from "@/lib/auth/entra/config";
import { pgQuery } from "@/lib/db/pool";
import { isAzureDataPlaneActive, isPersistentDataBackendAvailable } from "@/lib/data/data-plane";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeamInviteMode = "entra-token" | "supabase-auth";

export function resolveTeamInviteMode(): TeamInviteMode {
  return isEntraAuthEnabled() && isAzureDataPlaneActive() ? "entra-token" : "supabase-auth";
}

async function ensureTeamInvitesTable(): Promise<void> {
  if (!isAzureDataPlaneActive()) return;

  await pgQuery(`
    CREATE TABLE IF NOT EXISTS gcc_team_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id text NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
      email text NOT NULL,
      role text NOT NULL DEFAULT 'staff',
      invite_token text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending',
      invited_by uuid,
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, email, status)
    )
  `);
}

export async function sendTeamInvite(options: {
  organizationId: string;
  email: string;
  role: string;
  invitedBy?: string;
}): Promise<
  | { ok: true; inviteLink?: string; mode: TeamInviteMode }
  | { ok: false; message: string; mode: TeamInviteMode }
> {
  const mode = resolveTeamInviteMode();
  const normalizedEmail = options.email.trim().toLowerCase();

  if (mode === "entra-token") {
    if (!isPersistentDataBackendAvailable()) {
      return {
        ok: false,
        message: "Team invitations require Azure PostgreSQL when AUTH_PROVIDER=entra.",
        mode,
      };
    }

    await ensureTeamInvitesTable();
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inviteLink = `${getAppUrl()}/auth/callback?invite=${token}`;

    await pgQuery(
      `INSERT INTO gcc_team_invites (
         organization_id, email, role, invite_token, status, invited_by, expires_at
       ) VALUES ($1, $2, $3, $4, 'pending', $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        options.organizationId,
        normalizedEmail,
        options.role,
        token,
        options.invitedBy ?? null,
        expiresAt,
      ]
    );

    return { ok: true, inviteLink, mode };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Team invitations require a configured Supabase service role key.",
      mode,
    };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: {
      organization_id: options.organizationId,
      role: options.role,
    },
    redirectTo: `${getAppUrl()}/auth/callback`,
  });

  if (error) {
    return { ok: false, message: error.message, mode };
  }

  return { ok: true, mode };
}

export async function acceptPendingTeamInvite(
  email: string
): Promise<{ organizationId: string; role: string } | null> {
  if (!isAzureDataPlaneActive()) return null;

  await ensureTeamInvitesTable();
  const normalizedEmail = email.trim().toLowerCase();

  const pending = await pgQuery<{
    id: string;
    organization_id: string;
    role: string;
    invite_token: string;
  }>(
    `SELECT id, organization_id, role, invite_token
       FROM gcc_team_invites
      WHERE lower(email) = lower($1)
        AND status = 'pending'
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1`,
    [normalizedEmail]
  );

  const invite = pending.rows[0];
  if (!invite) return null;

  await pgQuery(
    `UPDATE gcc_team_invites SET status = 'accepted', accepted_at = now() WHERE id = $1`,
    [invite.id]
  );

  return { organizationId: invite.organization_id, role: invite.role };
}
