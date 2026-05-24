-- Growth Command Center — Full Schema
-- Run in Supabase SQL Editor (in order: schema.sql then seed.sql)

-- Organizations (tenants) — id matches app org ids e.g. org-apex
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  settings JSONB DEFAULT '{"cashAlertThreshold":150000,"forecastHorizonWeeks":13,"fiscalYearStart":1,"currency":"USD"}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id),
  full_name TEXT,
  role TEXT DEFAULT 'staff',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS monthly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  revenue NUMERIC NOT NULL DEFAULT 0,
  expenses NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  cash NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(organization_id, month)
);

CREATE TABLE IF NOT EXISTS budget_vs_actual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  actual NUMERIC NOT NULL DEFAULT 0,
  variance NUMERIC NOT NULL DEFAULT 0,
  variance_percent NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(organization_id, category)
);

CREATE TABLE IF NOT EXISTS kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kpi_key TEXT NOT NULL,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'number',
  change NUMERIC NOT NULL DEFAULT 0,
  change_label TEXT,
  target NUMERIC,
  UNIQUE(organization_id, kpi_key)
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_vs_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS "Users read own org" ON organizations;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users manage org integrations" ON integration_connections;

CREATE POLICY "Users read own org" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users manage org integrations" ON integration_connections
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Org members read financials" ON financial_snapshots
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Org members read trends" ON monthly_trends
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Org members read budget" ON budget_vs_actual
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Org members read kpis" ON kpis
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Org members read alerts" ON alerts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Signup trigger — organization_id is TEXT e.g. org-apex
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'founder'),
    COALESCE(NEW.raw_user_meta_data->>'organization_id', 'org-apex')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
