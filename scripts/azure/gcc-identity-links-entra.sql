-- Provider-neutral identity map for Entra External ID cutover.
-- identity_provider_id = Entra oid/sub (external IdP)
-- gcc_user_id = GCC profile PK (provider-neutral; not org id / ClientCode)
-- supabase_user_id = historical Supabase Auth UUID (nullable rollback link)

ALTER TABLE gcc_profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE gcc_profiles ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE TABLE IF NOT EXISTS gcc_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  identity_provider_id text,
  entra_object_id text,
  entra_subject text,
  gcc_user_id uuid,
  supabase_user_id uuid,
  organization_id text REFERENCES gcc_organizations(id),
  role text,
  disabled_at timestamptz,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entra_subject),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS gcc_identity_links_email_idx ON gcc_identity_links (lower(email));

-- Azure PG: drop Supabase auth.users FK on profiles if present (Entra users have no auth.users row).
ALTER TABLE gcc_profiles DROP CONSTRAINT IF EXISTS gcc_profiles_id_fkey;

REVOKE ALL ON TABLE gcc_identity_links FROM anon, authenticated;
