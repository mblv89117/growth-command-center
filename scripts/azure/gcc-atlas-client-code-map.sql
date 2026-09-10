-- Production ClientCode <-> organization map (fail-closed, unique both ways).
-- SYN01 must NEVER be inserted here as a production entitlement.

CREATE TABLE IF NOT EXISTS gcc_atlas_client_code_map (
  client_code text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES gcc_organizations(id),
  status text NOT NULL CHECK (status IN ('VERIFIED','MISSING_GCC_ORG','AMBIGUOUS','NOT_APPLICABLE')),
  verification_evidence text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gcc_atlas_client_code_map_org_unique UNIQUE (organization_id),
  CONSTRAINT gcc_atlas_client_code_map_code_format CHECK (client_code ~ '^[A-Z][A-Z0-9]{2,15}$'),
  CONSTRAINT gcc_atlas_client_code_map_verified_only CHECK (
    status <> 'VERIFIED' OR (organization_id IS NOT NULL AND length(trim(verification_evidence)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS gcc_atlas_client_code_map_status_idx
  ON gcc_atlas_client_code_map (status);

COMMENT ON TABLE gcc_atlas_client_code_map IS
  'Atlas ClientCode to GCC organization. Only VERIFIED rows authorize production routing.';
