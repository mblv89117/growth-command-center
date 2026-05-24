-- Growth Command Center — Full setup (safe for existing Supabase projects)
-- Run this entire file in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS gcc_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry TEXT,
  plan TEXT DEFAULT 'starter',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gcc_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES gcc_organizations(id),
  full_name TEXT,
  role TEXT DEFAULT 'staff',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gcc_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  current_cash NUMERIC NOT NULL DEFAULT 0,
  forecasted_cash NUMERIC NOT NULL DEFAULT 0,
  revenue_mtd NUMERIC NOT NULL DEFAULT 0,
  revenue_ytd NUMERIC NOT NULL DEFAULT 0,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  operating_expenses NUMERIC NOT NULL DEFAULT 0,
  accounts_receivable NUMERIC NOT NULL DEFAULT 0,
  accounts_payable NUMERIC NOT NULL DEFAULT 0,
  burn_rate NUMERIC NOT NULL DEFAULT 0,
  runway NUMERIC NOT NULL DEFAULT 0,
  debt_obligations NUMERIC NOT NULL DEFAULT 0,
  payroll_obligations NUMERIC NOT NULL DEFAULT 0,
  ebitda NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS gcc_monthly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  revenue NUMERIC NOT NULL DEFAULT 0,
  expenses NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  cash NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(organization_id, month)
);

CREATE TABLE IF NOT EXISTS gcc_budget_vs_actual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  actual NUMERIC NOT NULL DEFAULT 0,
  variance NUMERIC NOT NULL DEFAULT 0,
  variance_percent NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(organization_id, category)
);

CREATE TABLE IF NOT EXISTS gcc_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  kpi_key TEXT NOT NULL,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'number',
  change NUMERIC NOT NULL DEFAULT 0,
  change_label TEXT,
  target NUMERIC,
  UNIQUE(organization_id, kpi_key)
);

CREATE TABLE IF NOT EXISTS gcc_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  alert_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  recommended_action TEXT NOT NULL,
  affected_metric TEXT NOT NULL,
  due_date DATE,
  risk_window TEXT,
  owner TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, alert_key)
);

CREATE TABLE IF NOT EXISTS gcc_integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected',
  access_token TEXT,
  refresh_token TEXT,
  realm_id TEXT,
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  last_sync TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(organization_id, provider)
);

ALTER TABLE gcc_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_monthly_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_budget_vs_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gcc org read" ON gcc_organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));

CREATE POLICY "gcc profile read" ON gcc_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "gcc profile update" ON gcc_profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "gcc profile insert" ON gcc_profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "gcc financials read" ON gcc_financial_snapshots FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
CREATE POLICY "gcc trends read" ON gcc_monthly_trends FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
CREATE POLICY "gcc budget read" ON gcc_budget_vs_actual FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
CREATE POLICY "gcc kpis read" ON gcc_kpis FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
CREATE POLICY "gcc alerts read" ON gcc_alerts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
CREATE POLICY "gcc integrations all" ON gcc_integration_connections FOR ALL
  USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION gcc_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gcc_profiles (id, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'founder'),
    COALESCE(NEW.raw_user_meta_data->>'organization_id', 'org-apex')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS gcc_on_auth_user_created ON auth.users;
CREATE TRIGGER gcc_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION gcc_handle_new_user();
