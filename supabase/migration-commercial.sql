-- Growth Command Center — Commercial readiness migration
-- Run AFTER setup.sql and migration-v2.sql

-- Import jobs for CSV/XLSX ingestion
CREATE TABLE IF NOT EXISTS gcc_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  row_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  mapping JSONB DEFAULT '{}',
  preview JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  source_provenance TEXT DEFAULT 'import',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gcc_import_jobs_org ON gcc_import_jobs (organization_id, created_at DESC);

-- Background job / pipeline runs
CREATE TABLE IF NOT EXISTS gcc_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gcc_job_runs_org ON gcc_job_runs (organization_id, started_at DESC);

-- Forecast versions for "what changed"
CREATE TABLE IF NOT EXISTS gcc_forecast_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  version_num INT NOT NULL,
  ending_cash NUMERIC NOT NULL DEFAULT 0,
  minimum_cash NUMERIC NOT NULL DEFAULT 0,
  assumptions_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, version_num)
);

-- AI CFO conversations
CREATE TABLE IF NOT EXISTS gcc_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gcc_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES gcc_ai_conversations(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  data_sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcc_ai_messages_conv ON gcc_ai_messages (conversation_id, created_at);

-- Subscription trial tracking
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'empty';

-- KPI enabled flags
ALTER TABLE gcc_kpis ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

-- Updated signup trigger: provision org from company_name when no organization_id
CREATE OR REPLACE FUNCTION gcc_slugify(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEFT(REGEXP_REPLACE(LOWER(TRIM(COALESCE(input, 'workspace'))), '[^a-z0-9]+', '-', 'g'), 40);
$$;

CREATE OR REPLACE FUNCTION gcc_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id TEXT;
  v_slug TEXT;
  v_company TEXT;
  v_meta_org TEXT;
BEGIN
  v_meta_org := NEW.raw_user_meta_data->>'organization_id';
  v_company := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''), 'My Company');

  IF v_meta_org IS NOT NULL AND v_meta_org <> '' THEN
    v_org_id := v_meta_org;
  ELSE
    v_slug := gcc_slugify(v_company);
    v_org_id := 'org-' || v_slug;

    WHILE EXISTS (SELECT 1 FROM gcc_organizations WHERE id = v_org_id) LOOP
      v_slug := v_slug || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 4);
      v_org_id := 'org-' || v_slug;
    END LOOP;

    INSERT INTO gcc_organizations (id, name, slug, industry, plan, subscription_status, data_source)
    VALUES (v_org_id, v_company, v_slug, NULL, 'starter', 'trial', 'empty')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO gcc_financial_snapshots (organization_id)
    VALUES (v_org_id)
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;

  INSERT INTO public.gcc_profiles (id, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'founder'),
    v_org_id
  );

  RETURN NEW;
END;
$$;
