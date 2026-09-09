/**
 * Map Entra subjects onto existing GCC profiles/orgs.
 * Fail closed: never invent tenant or elevate role.
 */
import { getPgPool, pgQuery } from "@/lib/db/pool";
import type { EntraSession } from "./oidc";

export async function linkEntraIdentity(session: EntraSession): Promise<void> {
  if (!getPgPool()) return;

  await pgQuery(`
    CREATE TABLE IF NOT EXISTS gcc_identity_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      entra_object_id text,
      entra_subject text NOT NULL,
      supabase_user_id uuid,
      organization_id uuid,
      role text,
      linked_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (entra_subject),
      UNIQUE (email)
    )
  `);

  const existing = await pgQuery<{
    id: string;
    organization_id: string | null;
    role: string | null;
  }>(
    `SELECT id, organization_id, role
       FROM gcc_profiles
      WHERE lower(email) = lower($1)
      LIMIT 1`,
    [session.email]
  );
  const profile = existing.rows[0];

  await pgQuery(
    `INSERT INTO gcc_identity_links (
       email, entra_object_id, entra_subject, supabase_user_id, organization_id, role
     ) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (email) DO UPDATE SET
       entra_object_id = EXCLUDED.entra_object_id,
       entra_subject = EXCLUDED.entra_subject,
       linked_at = now()`,
    [
      session.email,
      session.oid ?? null,
      session.sub,
      profile?.id ?? null,
      profile?.organization_id ?? null,
      profile?.role ?? null,
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
    supabase_user_id: string | null;
    organization_id: string | null;
    role: string | null;
  }>(
    `SELECT supabase_user_id, organization_id, role
       FROM gcc_identity_links
      WHERE entra_subject = $1 OR lower(email) = lower($2)
      LIMIT 1`,
    [session.sub, session.email]
  );

  const row = linked.rows[0];
  if (!row?.organization_id || !row.role) return null;

  return {
    userId: row.supabase_user_id ?? session.sub,
    organizationId: row.organization_id,
    role: row.role,
    email: session.email,
  };
}
