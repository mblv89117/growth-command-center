-- Entra-mode team invitations (no Supabase Auth admin API).
-- Run on Azure PostgreSQL after core GCC schema migration.

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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gcc_team_invites_pending_email
  ON gcc_team_invites (organization_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_gcc_team_invites_org
  ON gcc_team_invites (organization_id, created_at DESC);

-- Server-side only (no anon/authenticated RLS policies in Entra cutover path).
REVOKE ALL ON TABLE gcc_team_invites FROM anon, authenticated;
