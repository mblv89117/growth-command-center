-- Growth Command Center — RLS hardening migration
-- Mission: GCC-AZURE-CUTOVER-SUPABASE-HARDENING-001
-- Run via: node scripts/run-supabase-sql.mjs rls
-- Idempotent; safe to re-run.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER for policy subqueries)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION gcc_auth_org_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM gcc_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION gcc_is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM gcc_profiles WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

-- Standard tenant isolation predicate for organization_id-scoped tables
CREATE OR REPLACE FUNCTION gcc_tenant_can_access(org_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gcc_is_platform_admin()
    OR org_id = gcc_auth_org_id();
$$;

-- ---------------------------------------------------------------------------
-- Server-only tables — RLS enabled, no client policies, revoke client grants
-- Backend uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'gcc_import_jobs',
    'gcc_job_runs',
    'gcc_forecast_versions',
    'gcc_ai_conversations',
    'gcc_ai_messages',
    'gcc_connector_sync_jobs',
    'gcc_data_provenance',
    'gcc_connector_audit',
    'gcc_pdf_import_jobs',
    'gcc_api_rate_limits'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', tbl);
    END IF;
  END LOOP;
END $$;

-- Drop any accidental permissive policies on server-only tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'gcc_import_jobs', 'gcc_job_runs', 'gcc_forecast_versions',
        'gcc_ai_conversations', 'gcc_ai_messages', 'gcc_connector_sync_jobs',
        'gcc_data_provenance', 'gcc_connector_audit', 'gcc_pdf_import_jobs',
        'gcc_api_rate_limits'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Tenant-scoped client-readable tables — ensure RLS + org-scoped SELECT
-- (Write paths use service role; authenticated users read own org only.)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
  pol_name TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'gcc_cash_forecast_weeks', 'gcc_cash_forecast_months', 'gcc_scenarios',
    'gcc_forecast_assumptions', 'gcc_opportunities', 'gcc_jobs',
    'gcc_invoices', 'gcc_bills', 'gcc_transactions', 'gcc_expense_categories',
    'gcc_revenue_sources', 'gcc_aging_buckets', 'gcc_subscriptions',
    'gcc_bank_accounts', 'gcc_onboarding_messages'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      pol_name := tbl || ' tenant select';
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, tbl);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (gcc_tenant_can_access(organization_id))',
        pol_name, tbl
      );
    END IF;
  END LOOP;
END $$;

-- Core tables — refresh policies (idempotent)
ALTER TABLE IF EXISTS gcc_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gcc org read" ON gcc_organizations;
CREATE POLICY "gcc org read" ON gcc_organizations
  FOR SELECT TO authenticated
  USING (gcc_tenant_can_access(id));

ALTER TABLE IF EXISTS gcc_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gcc profile read" ON gcc_profiles;
CREATE POLICY "gcc profile read" ON gcc_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR gcc_is_platform_admin());

DROP POLICY IF EXISTS "gcc profile update" ON gcc_profiles;
CREATE POLICY "gcc profile update" ON gcc_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "gcc profile insert" ON gcc_profiles;
CREATE POLICY "gcc profile insert" ON gcc_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Financial / tenant data — authenticated read only (writes via service role)
DO $$
DECLARE
  tbl TEXT;
  pol_name TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'gcc_financial_snapshots', 'gcc_monthly_trends', 'gcc_budget_vs_actual',
    'gcc_kpis', 'gcc_alerts'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      pol_name := tbl || ' tenant select';
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'gcc financials read', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'gcc trends read', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'gcc budget read', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'gcc kpis read', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'gcc alerts read', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (gcc_tenant_can_access(organization_id))',
        pol_name, tbl
      );
    END IF;
  END LOOP;
END $$;

-- Integration connections contain OAuth tokens — deny direct client access
ALTER TABLE IF EXISTS gcc_integration_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gcc integrations all" ON gcc_integration_connections;
REVOKE ALL ON gcc_integration_connections FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Legacy non-gcc_ tables (if present from early schema.sql)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organizations', 'profiles', 'integration_connections',
    'financial_snapshots', 'monthly_trends', 'budget_vs_actual',
    'kpis', 'alerts'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', tbl);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Remove security-test probe rows (created during pre-migration audit)
-- ---------------------------------------------------------------------------

DELETE FROM gcc_ai_messages WHERE content = 'probe';
DELETE FROM gcc_import_jobs WHERE file_name = 'probe.csv' AND template_type = 'test';
DELETE FROM gcc_job_runs WHERE job_type = 'probe';
DELETE FROM gcc_forecast_versions WHERE version_num = 99999;
