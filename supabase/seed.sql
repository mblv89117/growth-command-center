-- Growth Command Center — Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor

INSERT INTO organizations (id, name, slug, industry, plan) VALUES
  ('org-apex', 'Apex Construction Group', 'apex-construction', 'Commercial Construction', 'growth'),
  ('org-summit', 'Summit Renovations LLC', 'summit-renovations', 'Residential Renovation', 'starter')
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_snapshots (
  organization_id, current_cash, forecasted_cash, revenue_mtd, revenue_ytd,
  gross_profit, net_profit, operating_expenses, accounts_receivable, accounts_payable,
  burn_rate, runway, debt_obligations, payroll_obligations, ebitda
) VALUES (
  'org-apex', 487250, 412800, 892400, 6840000,
  2456800, 892400, 1564400, 1245800, 687300,
  142000, 3.4, 450000, 186400, 1125600
) ON CONFLICT (organization_id) DO UPDATE SET
  current_cash = EXCLUDED.current_cash,
  forecasted_cash = EXCLUDED.forecasted_cash,
  revenue_mtd = EXCLUDED.revenue_mtd,
  updated_at = NOW();

INSERT INTO monthly_trends (organization_id, month, revenue, expenses, profit, cash, sort_order) VALUES
  ('org-apex', 'Jan', 520000, 412000, 108000, 380000, 1),
  ('org-apex', 'Feb', 480000, 398000, 82000, 395000, 2),
  ('org-apex', 'Mar', 610000, 445000, 165000, 420000, 3),
  ('org-apex', 'Apr', 580000, 432000, 148000, 445000, 4),
  ('org-apex', 'May', 720000, 478000, 242000, 462000, 5),
  ('org-apex', 'Jun', 680000, 465000, 215000, 478000, 6),
  ('org-apex', 'Jul', 750000, 492000, 258000, 485000, 7),
  ('org-apex', 'Aug', 710000, 488000, 222000, 487250, 8),
  ('org-apex', 'Sep', 892400, 512000, 380400, 487250, 9)
ON CONFLICT (organization_id, month) DO NOTHING;

INSERT INTO budget_vs_actual (organization_id, category, budget, actual, variance, variance_percent) VALUES
  ('org-apex', 'Revenue', 850000, 892400, 42400, 5.0),
  ('org-apex', 'Labor', 320000, 298400, 21600, 6.8),
  ('org-apex', 'Materials', 245000, 268200, -23200, -9.5),
  ('org-apex', 'Subcontractors', 180000, 172800, 7200, 4.0),
  ('org-apex', 'Operating Expenses', 95000, 98400, -3400, -3.6),
  ('org-apex', 'Payroll', 186000, 186400, -400, -0.2)
ON CONFLICT (organization_id, category) DO NOTHING;

INSERT INTO kpis (organization_id, kpi_key, name, value, unit, change, change_label, target) VALUES
  ('org-apex', 'revenue_growth', 'Revenue Growth', 12.4, 'percent', 2.1, 'vs last month', 10),
  ('org-apex', 'gross_margin', 'Gross Margin', 35.9, 'percent', -1.2, 'vs last month', 32),
  ('org-apex', 'net_margin', 'Net Margin', 13.0, 'percent', 0.8, 'vs last month', 12),
  ('org-apex', 'cash_conversion', 'Cash Conversion Cycle', 42, 'days', -3, 'vs last quarter', 45),
  ('org-apex', 'ar_days', 'AR Days', 48, 'days', 5, 'vs last month', 40),
  ('org-apex', 'ap_days', 'AP Days', 32, 'days', -2, 'vs last month', 35),
  ('org-apex', 'close_rate', 'Sales Close Rate', 34, 'percent', 4, 'vs last quarter', 30),
  ('org-apex', 'avg_deal', 'Average Deal Size', 1420000, 'currency', 8.5, 'vs last quarter', NULL),
  ('org-apex', 'job_profit', 'Job Profitability', 26.8, 'percent', -2.4, 'vs estimate', 28),
  ('org-apex', 'opex_ratio', 'Operating Expense Ratio', 22.9, 'percent', -0.5, 'vs last month', 24),
  ('org-apex', 'dscr', 'Debt Service Coverage', 1.8, 'number', -0.2, 'vs last quarter', 1.5),
  ('org-apex', 'runway', 'Runway', 3.4, 'number', -0.3, 'months', 6),
  ('org-apex', 'ebitda', 'EBITDA', 1125600, 'currency', 15.2, 'vs last month', NULL)
ON CONFLICT (organization_id, kpi_key) DO NOTHING;

INSERT INTO alerts (organization_id, alert_key, title, description, severity, recommended_action, affected_metric, risk_window, owner, is_read) VALUES
  ('org-apex', 'cash-week8', 'Cash Below Threshold in Week 8', 'Projected cash balance drops to $160,450 during week of Jul 14 due to equipment purchase and payroll cycle.', 'critical', 'Accelerate AR collections on INV-2025-0847 ($285K) and delay equipment deposit by 2 weeks.', 'Cash Balance', 'Jul 14–20, 2025', 'Sarah Chen', false),
  ('org-apex', 'ar-aging', 'AR Aging Risk — $519K Overdue', 'Three invoices totaling $519K are past due, with Golden Years Corp invoice 39 days outstanding.', 'high', 'Escalate collection calls for INV-2025-0822. Consider lien rights on Senior Living project.', 'Accounts Receivable', NULL, 'Mike Torres', false),
  ('org-apex', 'hotel-margin', 'Low Gross Margin on Boutique Hotel', 'Job profitability at 18.2% vs 35% estimate due to material cost overruns and change orders.', 'high', 'Review change order billing. Renegotiate remaining subcontractor scope.', 'Gross Margin', NULL, 'Tom Bradley', true),
  ('org-apex', 'payroll-due', 'Payroll Due in 6 Days', 'Bi-weekly payroll of $186,400 due May 30. Current cash sufficient but reduces forecast buffer.', 'medium', 'Confirm payroll funding. Review overtime hours on active jobs.', 'Payroll', NULL, 'Sarah Chen', true),
  ('org-apex', 'revenue-forecast', 'Revenue Below Forecast', 'May revenue tracking 4.2% below forecast due to delayed Harbor View billing milestone.', 'medium', 'Expedite progress billing on Harbor View Phase 2 (62% complete).', 'Revenue', NULL, 'Amy Foster', false),
  ('org-apex', 'ap-pressure', 'AP Pressure — Concrete Masters Overdue', '$67,200 materials bill 4 days overdue. Vendor threatening hold on future deliveries.', 'medium', 'Process payment immediately to maintain vendor relationship.', 'Accounts Payable', NULL, 'Sarah Chen', false),
  ('org-apex', 'debt-coverage', 'Debt Coverage Concern', 'Debt service coverage ratio projected at 1.2x in July, below 1.5x covenant threshold.', 'critical', 'Prepare lender communication. Model impact of delayed capex on coverage ratio.', 'Debt Service Coverage', 'Jul 2025', 'Sarah Chen', false)
ON CONFLICT (organization_id, alert_key) DO NOTHING;
