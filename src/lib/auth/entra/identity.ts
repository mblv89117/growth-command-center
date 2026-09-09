/**
 * Map Entra subjects onto GCC profiles/orgs.
 * Fail closed: never invent tenant or elevate role.
 *
 * Column semantics (gcc_identity_links):
 * - identity_provider_id — Entra oid/sub (external IdP subject)
 * - gcc_user_id — provider-neutral GCC profile PK (not ClientCode / org id)
 * - organization_id — tenant scope
 * - supabase_user_id — historical Supabase Auth UUID link (nullable after cutover)
 */
import { getPgPool, pgQuery } from "@/lib/db/pool";
import { acceptPendingTeamInvite } from "@/lib/data/team-invite";
import { generateProviderNeutralUserId } from "@/lib/data/active-runtime-plane";
import type { EntraSession } from "./oidc";

export async function ensureIdentityLinksTable(): Promise<void> {
  if (!getPgPool()) return;

  await pgQuery(`
    CREATE TABLE IF NOT EXISTS gcc_identity_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      identity_provider_id text,
      entra_object_id text,
      entra_subject text,
      gcc_user_id uuid,
      supabase_user_id uuid,
      organization_id text,
      role text,
      disabled_at timestamptz,
      linked_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (entra_subject),
      UNIQUE (email)
    )
  `);
}

export async function linkEntraIdentity(session: EntraSession): Promise<void> {
  if (!getPgPool()) return;

  await ensureIdentityLinksTable();

  const invite = await acceptPendingTeamInvite(session.email);

  const existing = await pgQuery<{
    id: string;
    organization_id: string | null;
    role: string | null;
    disabled_at: string | null;
  }>(
    `SELECT id, organization_id, role, disabled_at
       FROM gcc_profiles
      WHERE lower(email) = lower($1)
      LIMIT 1`,
    [session.email]
  );
  const profile = existing.rows[0];

  const organizationId = invite?.organizationId ?? profile?.organization_id ?? null;
  const role = invite?.role ?? profile?.role ?? null;
  const gccUserId = profile?.id ?? generateProviderNeutralUserId();

  if (profile && profile.disabled_at) {
    return;
  }

  if (!profile && organizationId && role) {
    await pgQuery(
      `INSERT INTO gcc_profiles (id, email, organization_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         organization_id = COALESCE(gcc_profiles.organization_id, EXCLUDED.organization_id),
         role = COALESCE(gcc_profiles.role, EXCLUDED.role)`,
      [gccUserId, session.email, organizationId, role]
    );
  }

  await pgQuery(
    `INSERT INTO gcc_identity_links (
       email, identity_provider_id, entra_object_id, entra_subject,
       gcc_user_id, supabase_user_id, organization_id, role
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (email) DO UPDATE SET
       identity_provider_id = EXCLUDED.identity_provider_id,
       entra_object_id = EXCLUDED.entra_object_id,
       entra_subject = EXCLUDED.entra_subject,
       gcc_user_id = COALESCE(gcc_identity_links.gcc_user_id, EXCLUDED.gcc_user_id),
       supabase_user_id = COALESCE(gcc_identity_links.supabase_user_id, EXCLUDED.supabase_user_id),
       organization_id = COALESCE(EXCLUDED.organization_id, gcc_identity_links.organization_id),
       role = COALESCE(EXCLUDED.role, gcc_identity_links.role),
       linked_at = now()`,
    [
      session.email,
      session.oid ?? session.sub,
      session.oid ?? null,
      session.sub,
      gccUserId,
      profile?.id ?? null,
      organizationId,
      role,
    ]
  );
}

export async function resolveProfileForEntra(session: EntraSession): Promise<{
  userId: string;
  organizationId: string;
  role: string;
  email: string;
} | null> {
  if (!getPgPool()) return null;

  const linked = await pgQuery<{
    gcc_user_id: string | null;
    supabase_user_id: string | null;
    organization_id: string | null;
    role: string | null;
    disabled_at: string | null;
  }>(
    `SELECT l.gcc_user_id, l.supabase_user_id, l.organization_id, l.role, p.disabled_at
       FROM gcc_identity_links l
       LEFT JOIN gcc_profiles p ON p.id = COALESCE(l.gcc_user_id, l.supabase_user_id)
      WHERE l.entra_subject = $1 OR lower(l.email) = lower($2)
      LIMIT 1`,
    [session.sub, session.email]
  );

  const row = linked.rows[0];
  if (!row?.organization_id || !row.role) return null;
  if (row.role === "disabled" || row.disabled_at) return null;

  return {
    userId: row.gcc_user_id ?? row.supabase_user_id ?? session.sub,
    organizationId: row.organization_id,
    role: row.role,
    email: session.email,
  };
}
