-- Growth Command Center — Migration v2
-- Run AFTER setup.sql in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS gcc_cash_forecast_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  week_num INT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  starting_balance NUMERIC NOT NULL DEFAULT 0,
  inflows NUMERIC NOT NULL DEFAULT 0,
  outflows NUMERIC NOT NULL DEFAULT 0,
  ending_balance NUMERIC NOT NULL DEFAULT 0,
  is_risk_period BOOLEAN DEFAULT FALSE,
  UNIQUE(organization_id, week_num)
);

CREATE TABLE IF NOT EXISTS gcc_cash_forecast_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  month_label TEXT NOT NULL,
  inflows NUMERIC NOT NULL DEFAULT 0,
  outflows NUMERIC NOT NULL DEFAULT 0,
  ending_balance NUMERIC NOT NULL DEFAULT 0,
  is_risk_period BOOLEAN DEFAULT FALSE,
  UNIQUE(organization_id, month_label)
);

CREATE TABLE IF NOT EXISTS gcc_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  scenario_key TEXT NOT NULL,
  name TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  revenue_growth_rate NUMERIC NOT NULL DEFAULT 0,
  collection_timing_days INT NOT NULL DEFAULT 45,
  expense_increase_rate NUMERIC NOT NULL DEFAULT 0,
  ending_cash NUMERIC NOT NULL DEFAULT 0,
  minimum_cash NUMERIC NOT NULL DEFAULT 0,
  runway NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  UNIQUE(organization_id, scenario_key)
);

CREATE TABLE IF NOT EXISTS gcc_forecast_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  assumption_key TEXT NOT NULL,
  category TEXT NOT NULL,
  assumption_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL,
  start_date DATE,
  notes TEXT,
  UNIQUE(organization_id, assumption_key)
);

CREATE TABLE IF NOT EXISTS gcc_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  opp_key TEXT NOT NULL,
  name TEXT NOT NULL,
  customer TEXT NOT NULL,
  stage TEXT NOT NULL,
  probability INT NOT NULL DEFAULT 0,
  value NUMERIC NOT NULL DEFAULT 0,
  expected_close_date DATE,
  rep TEXT,
  source TEXT,
  weighted_value NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(organization_id, opp_key)
);

CREATE TABLE IF NOT EXISTS gcc_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  job_key TEXT NOT NULL,
  name TEXT NOT NULL,
  customer TEXT NOT NULL,
  status TEXT NOT NULL,
  contract_value NUMERIC NOT NULL DEFAULT 0,
  estimated_gross_margin NUMERIC NOT NULL DEFAULT 0,
  actual_gross_margin NUMERIC NOT NULL DEFAULT 0,
  labor_cost NUMERIC NOT NULL DEFAULT 0,
  material_cost NUMERIC NOT NULL DEFAULT 0,
  subcontractor_cost NUMERIC NOT NULL DEFAULT 0,
  completion_percent INT NOT NULL DEFAULT 0,
  expected_billing_date DATE,
  expected_collection_date DATE,
  project_manager TEXT,
  UNIQUE(organization_id, job_key)
);

CREATE TABLE IF NOT EXISTS gcc_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  invoice_key TEXT NOT NULL,
  number TEXT NOT NULL,
  customer TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL,
  days_outstanding INT DEFAULT 0,
  UNIQUE(organization_id, invoice_key)
);

CREATE TABLE IF NOT EXISTS gcc_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  bill_key TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL,
  category TEXT,
  UNIQUE(organization_id, bill_key)
);

CREATE TABLE IF NOT EXISTS gcc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  txn_key TEXT NOT NULL,
  txn_date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  txn_type TEXT NOT NULL,
  UNIQUE(organization_id, txn_key)
);

CREATE TABLE IF NOT EXISTS gcc_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  percent_of_revenue NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(organization_id, category)
);

CREATE TABLE IF NOT EXISTS gcc_revenue_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  percent NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(organization_id, source)
);

CREATE TABLE IF NOT EXISTS gcc_aging_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  bucket_type TEXT NOT NULL,
  bucket TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  count INT NOT NULL DEFAULT 0,
  UNIQUE(organization_id, bucket_type, bucket)
);

CREATE TABLE IF NOT EXISTS gcc_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS gcc_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES gcc_organizations(id) ON DELETE CASCADE,
  plaid_account_id TEXT,
  name TEXT NOT NULL,
  mask TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  institution TEXT,
  last_sync TIMESTAMPTZ,
  UNIQUE(organization_id, plaid_account_id)
);

ALTER TABLE gcc_cash_forecast_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_cash_forecast_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_forecast_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_revenue_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_aging_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcc_bank_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "gcc forecast weeks read" ON gcc_cash_forecast_weeks FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc forecast months read" ON gcc_cash_forecast_months FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc scenarios read" ON gcc_scenarios FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc assumptions read" ON gcc_forecast_assumptions FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc opportunities read" ON gcc_opportunities FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc jobs read" ON gcc_jobs FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc invoices read" ON gcc_invoices FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc bills read" ON gcc_bills FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc transactions read" ON gcc_transactions FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc expense cats read" ON gcc_expense_categories FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc revenue sources read" ON gcc_revenue_sources FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc aging read" ON gcc_aging_buckets FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc subscriptions read" ON gcc_subscriptions FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
  CREATE POLICY "gcc bank accounts read" ON gcc_bank_accounts FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM gcc_profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Stripe columns on organizations
ALTER TABLE gcc_organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
