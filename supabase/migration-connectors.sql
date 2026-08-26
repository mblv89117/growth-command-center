-- Growth Command Center — Universal Connector Framework migration
-- Run AFTER migration-commercial.sql

-- Connector sync cursors and job metadata
CREATE TABLE IF NOT EXISTS gcc_connector_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'incremental',
  status TEXT NOT NULL DEFAULT 'pending',
  records_synced INT DEFAULT 0,
  error_message TEXT,
  cursor_token TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gcc_connector_sync_jobs_org
  ON gcc_connector_sync_jobs (organization_id, connector_id, started_at DESC);

-- Data provenance per field
CREATE TABLE IF NOT EXISTS gcc_data_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  value_numeric NUMERIC,
  value_text TEXT,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'connector',
  connector_id TEXT,
  file_name TEXT,
  period_start TEXT,
  period_end TEXT,
  category TEXT NOT NULL DEFAULT 'UNKNOWN',
  confidence TEXT,
  synced_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, field_key, source)
);

CREATE INDEX IF NOT EXISTS idx_gcc_data_provenance_org
  ON gcc_data_provenance (organization_id);

-- Connector audit trail (no secrets)
CREATE TABLE IF NOT EXISTS gcc_connector_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcc_connector_audit_org
  ON gcc_connector_audit (organization_id, created_at DESC);

-- PDF import jobs (pending confirmation)
CREATE TABLE IF NOT EXISTS gcc_pdf_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  document_type TEXT,
  period_start TEXT,
  period_end TEXT,
  extracted_fields JSONB DEFAULT '{}',
  confirmed_fields JSONB,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  provenance_category TEXT DEFAULT 'AI_EXTRACTED_PENDING_CONFIRMATION',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gcc_pdf_import_jobs_org
  ON gcc_pdf_import_jobs (organization_id, created_at DESC);

-- Entitlement model
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'trial';
-- access_type: trial | standalone | hvcg_included | inactive

ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS hvcg_client_since TIMESTAMPTZ;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS hvcg_engagement_active BOOLEAN DEFAULT FALSE;

-- GTM attribution
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS landing_page TEXT;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS referrer TEXT;

-- Extend integration connections for connector framework
ALTER TABLE gcc_integration_connections ADD COLUMN IF NOT EXISTS connector_state TEXT DEFAULT 'disconnected';
ALTER TABLE gcc_integration_connections ADD COLUMN IF NOT EXISTS sync_cursor TEXT;
ALTER TABLE gcc_integration_connections ADD COLUMN IF NOT EXISTS data_range_start TEXT;
ALTER TABLE gcc_integration_connections ADD COLUMN IF NOT EXISTS data_range_end TEXT;
