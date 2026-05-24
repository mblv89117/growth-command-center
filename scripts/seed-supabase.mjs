#!/usr/bin/env node
/**
 * Creates gcc_* tables via Supabase REST (requires tables to exist).
 * For initial setup, run supabase/setup.sql in Supabase SQL Editor first.
 * Usage: npm run db:seed
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureTables() {
  const { error } = await supabase.from("gcc_organizations").select("id", { head: true, count: "exact" });
  if (error?.message?.includes("Could not find the table")) {
    console.error("\n❌ gcc_* tables not found.");
    console.error("   Open Supabase SQL Editor and run: supabase/setup.sql");
    console.error("   Then run: npm run db:seed\n");
    process.exit(1);
  }
}

async function seed() {
  await ensureTables();

  const { error: orgErr } = await supabase.from("gcc_organizations").upsert([
    { id: "org-apex", name: "Apex Construction Group", slug: "apex-construction", industry: "Commercial Construction", plan: "growth" },
    { id: "org-summit", name: "Summit Renovations LLC", slug: "summit-renovations", industry: "Residential Renovation", plan: "starter" },
  ]);
  if (orgErr) throw orgErr;

  const { error: finErr } = await supabase.from("gcc_financial_snapshots").upsert({
    organization_id: "org-apex",
    current_cash: 487250, forecasted_cash: 412800, revenue_mtd: 892400, revenue_ytd: 6840000,
    gross_profit: 2456800, net_profit: 892400, operating_expenses: 1564400,
    accounts_receivable: 1245800, accounts_payable: 687300, burn_rate: 142000, runway: 3.4,
    debt_obligations: 450000, payroll_obligations: 186400, ebitda: 1125600,
  }, { onConflict: "organization_id" });
  if (finErr) throw finErr;

  const trends = [
    ["Jan", 520000, 412000, 108000, 380000, 1], ["Feb", 480000, 398000, 82000, 395000, 2],
    ["Mar", 610000, 445000, 165000, 420000, 3], ["Apr", 580000, 432000, 148000, 445000, 4],
    ["May", 720000, 478000, 242000, 462000, 5], ["Jun", 680000, 465000, 215000, 478000, 6],
    ["Jul", 750000, 492000, 258000, 485000, 7], ["Aug", 710000, 488000, 222000, 487250, 8],
    ["Sep", 892400, 512000, 380400, 487250, 9],
  ].map(([month, revenue, expenses, profit, cash, sort_order]) => ({
    organization_id: "org-apex", month, revenue, expenses, profit, cash, sort_order,
  }));
  const { error: trendErr } = await supabase.from("gcc_monthly_trends").upsert(trends, { onConflict: "organization_id,month" });
  if (trendErr) throw trendErr;

  const budget = [
    ["Revenue", 850000, 892400, 42400, 5.0], ["Labor", 320000, 298400, 21600, 6.8],
    ["Materials", 245000, 268200, -23200, -9.5], ["Subcontractors", 180000, 172800, 7200, 4.0],
    ["Operating Expenses", 95000, 98400, -3400, -3.6], ["Payroll", 186000, 186400, -400, -0.2],
  ].map(([category, budget, actual, variance, variance_percent]) => ({
    organization_id: "org-apex", category, budget, actual, variance, variance_percent,
  }));
  const { error: budgetErr } = await supabase.from("gcc_budget_vs_actual").upsert(budget, { onConflict: "organization_id,category" });
  if (budgetErr) throw budgetErr;

  const kpis = [
    ["revenue_growth", "Revenue Growth", 12.4, "percent", 2.1, "vs last month", 10],
    ["gross_margin", "Gross Margin", 35.9, "percent", -1.2, "vs last month", 32],
    ["net_margin", "Net Margin", 13.0, "percent", 0.8, "vs last month", 12],
    ["runway", "Runway", 3.4, "number", -0.3, "months", 6],
    ["ebitda", "EBITDA", 1125600, "currency", 15.2, "vs last month", null],
  ].map(([kpi_key, name, value, unit, change, change_label, target]) => ({
    organization_id: "org-apex", kpi_key, name, value, unit, change, change_label, target,
  }));
  const { error: kpiErr } = await supabase.from("gcc_kpis").upsert(kpis, { onConflict: "organization_id,kpi_key" });
  if (kpiErr) throw kpiErr;

  const alerts = [
    { alert_key: "cash-week8", title: "Cash Below Threshold in Week 8", description: "Projected cash drops to $160,450 in week of Jul 14.", severity: "critical", recommended_action: "Accelerate AR collections.", affected_metric: "Cash Balance", risk_window: "Jul 14–20, 2025", owner: "Sarah Chen", is_read: false },
    { alert_key: "ar-aging", title: "AR Aging Risk — $519K Overdue", description: "Three invoices past due.", severity: "high", recommended_action: "Escalate collections.", affected_metric: "Accounts Receivable", owner: "Mike Torres", is_read: false },
  ].map((a) => ({ organization_id: "org-apex", ...a }));
  const { error: alertErr } = await supabase.from("gcc_alerts").upsert(alerts, { onConflict: "organization_id,alert_key" });
  if (alertErr) throw alertErr;

  const { count } = await supabase.from("gcc_organizations").select("*", { count: "exact", head: true });
  console.log("✅ Seed complete —", count, "organizations loaded");

  await seedV2();
}

async function seedV2() {
  const org = "org-apex";

  const tables = [
    {
      name: "gcc_cash_forecast_weeks",
      rows: [
        [1, "2025-05-26", "2025-06-01", 487250, 312000, 298400, 500850, false],
        [2, "2025-06-02", "2025-06-08", 500850, 285000, 312000, 473850, false],
        [3, "2025-06-09", "2025-06-15", 473850, 298000, 325000, 446850, false],
        [4, "2025-06-16", "2025-06-22", 446850, 275000, 342000, 379850, false],
        [5, "2025-06-23", "2025-06-29", 379850, 320000, 298000, 401850, false],
        [6, "2025-06-30", "2025-07-06", 401850, 265000, 386400, 280450, false],
        [7, "2025-07-07", "2025-07-13", 280450, 310000, 295000, 295450, false],
        [8, "2025-07-14", "2025-07-20", 295450, 245000, 380000, 160450, true],
        [9, "2025-07-21", "2025-07-27", 160450, 335000, 288000, 207450, false],
        [10, "2025-07-28", "2025-08-03", 207450, 298000, 302000, 203450, false],
        [11, "2025-08-04", "2025-08-10", 203450, 275000, 315000, 163450, false],
        [12, "2025-08-11", "2025-08-17", 163450, 342000, 298000, 207450, false],
        [13, "2025-08-18", "2025-08-24", 207450, 310000, 305000, 212450, false],
      ].map(([week_num, week_start, week_end, starting_balance, inflows, outflows, ending_balance, is_risk_period]) => ({
        organization_id: org, week_num, week_start, week_end, starting_balance, inflows, outflows, ending_balance, is_risk_period,
      })),
      conflict: "organization_id,week_num",
    },
    {
      name: "gcc_cash_forecast_months",
      rows: [
        ["Jun 2025", 1190000, 1273400, 401850, false],
        ["Jul 2025", 1100000, 1359400, 142506, true],
        ["Aug 2025", 1225000, 1210000, 157506, false],
        ["Sep 2025", 1350000, 1180000, 327506, false],
        ["Oct 2025", 1280000, 1220000, 387506, false],
        ["Nov 2025", 1150000, 1250000, 287506, false],
      ].map(([month_label, inflows, outflows, ending_balance, is_risk_period]) => ({
        organization_id: org, month_label, inflows, outflows, ending_balance, is_risk_period,
      })),
      conflict: "organization_id,month_label",
    },
    {
      name: "gcc_scenarios",
      rows: [
        ["sc-base", "Base Case", "base", 8, 45, 3, 212450, 160450, 3.4, "Current trajectory with moderate growth"],
        ["sc-best", "Best Case", "best", 18, 35, 2, 385200, 298400, 5.8, "Strong sales, faster collections"],
        ["sc-worst", "Worst Case", "worst", -5, 60, 8, 45200, 28400, 0.8, "Delayed projects, slow AR"],
        ["sc-growth", "Growth Case", "growth", 25, 40, 12, 298600, 125000, 4.2, "Aggressive expansion"],
        ["sc-downside", "Downside Case", "downside", 0, 55, 6, 98400, 52000, 1.6, "Flat revenue with cost pressure"],
      ].map(([scenario_key, name, scenario_type, revenue_growth_rate, collection_timing_days, expense_increase_rate, ending_cash, minimum_cash, runway, description]) => ({
        organization_id: org, scenario_key, name, scenario_type, revenue_growth_rate, collection_timing_days, expense_increase_rate, ending_cash, minimum_cash, runway, description,
      })),
      conflict: "organization_id,scenario_key",
    },
    {
      name: "gcc_forecast_assumptions",
      rows: [
        ["fa-1", "Receivables Collection", "inflow", 285000, "weekly", "2025-05-26", null],
        ["fa-2", "New Sales Revenue", "inflow", 175000, "weekly", "2025-05-26", null],
        ["fa-3", "Recurring Service Revenue", "inflow", 42000, "monthly", "2025-05-26", null],
        ["fa-4", "Payroll", "outflow", 186400, "monthly", "2025-05-26", null],
        ["fa-5", "Rent & Facilities", "outflow", 18500, "monthly", "2025-05-26", null],
        ["fa-6", "Subcontractors", "outflow", 95000, "weekly", "2025-05-26", null],
        ["fa-7", "Materials", "outflow", 72000, "weekly", "2025-05-26", null],
        ["fa-8", "Loan Payment", "outflow", 12500, "monthly", "2025-05-26", null],
        ["fa-9", "Equipment Purchase", "outflow", 85000, "one_time", "2025-07-15", "New excavator deposit"],
      ].map(([assumption_key, category, assumption_type, amount, frequency, start_date, notes]) => ({
        organization_id: org, assumption_key, category, assumption_type, amount, frequency, start_date, notes,
      })),
      conflict: "organization_id,assumption_key",
    },
    {
      name: "gcc_opportunities",
      rows: [
        ["opp-1", "Riverside Office Complex", "Meridian Properties", "negotiation", 75, 2400000, "2025-06-30", "Mike Torres", "Referral", 1800000],
        ["opp-2", "Downtown Retail Fit-Out", "Urban Retail Group", "proposal", 50, 680000, "2025-07-15", "Lisa Park", "HubSpot", 340000],
        ["opp-3", "Warehouse Expansion", "LogiCore Inc", "qualified", 40, 1200000, "2025-08-01", "Mike Torres", "Website", 480000],
        ["opp-4", "School Renovation Phase 2", "Oak Valley School District", "proposal", 65, 890000, "2025-06-20", "James Wilson", "Existing Client", 578500],
        ["opp-5", "Medical Center Build-Out", "HealthFirst Partners", "lead", 20, 3500000, "2025-09-30", "Lisa Park", "Trade Show", 700000],
        ["opp-6", "Restaurant Chain Rollout", "Coastal Dining Co", "negotiation", 80, 520000, "2025-06-10", "James Wilson", "Referral", 416000],
        ["opp-7", "Apartment Complex Phase 3", "Harbor Living LLC", "closed_won", 100, 1850000, "2025-05-15", "Mike Torres", "Existing Client", 1850000],
      ].map(([opp_key, name, customer, stage, probability, value, expected_close_date, rep, source, weighted_value]) => ({
        organization_id: org, opp_key, name, customer, stage, probability, value, expected_close_date, rep, source, weighted_value,
      })),
      conflict: "organization_id,opp_key",
    },
    {
      name: "gcc_jobs",
      rows: [
        ["job-1", "Harbor View Apartments - Phase 2", "Harbor Living LLC", "active", 1850000, 28, 26.5, 420000, 580000, 245000, 62, "2025-06-15", "2025-07-15", "Tom Bradley"],
        ["job-2", "Tech Park Building C", "Innovate Campus LLC", "active", 980000, 32, 30.2, 245000, 312000, 98000, 45, "2025-06-30", "2025-07-30", "Amy Foster"],
        ["job-3", "City Library Renovation", "Oak Valley School District", "active", 720000, 25, 22.8, 198000, 245000, 86000, 78, "2025-05-28", "2025-06-28", "Tom Bradley"],
        ["job-4", "Industrial Park Warehouse", "LogiCore Inc", "planning", 1450000, 30, 0, 0, 45000, 12000, 5, "2025-08-15", "2025-09-15", "Amy Foster"],
        ["job-5", "Boutique Hotel Lobby", "Coastal Hospitality", "active", 385000, 35, 18.2, 98000, 142000, 45000, 55, "2025-06-20", "2025-07-20", "Tom Bradley"],
        ["job-6", "Senior Living Facility", "Golden Years Corp", "on_hold", 2100000, 27, 24.1, 312000, 398000, 156000, 35, "2025-09-01", "2025-10-01", "Amy Foster"],
      ].map(([job_key, name, customer, status, contract_value, estimated_gross_margin, actual_gross_margin, labor_cost, material_cost, subcontractor_cost, completion_percent, expected_billing_date, expected_collection_date, project_manager]) => ({
        organization_id: org, job_key, name, customer, status, contract_value, estimated_gross_margin, actual_gross_margin, labor_cost, material_cost, subcontractor_cost, completion_percent, expected_billing_date, expected_collection_date, project_manager,
      })),
      conflict: "organization_id,job_key",
    },
    {
      name: "gcc_invoices",
      rows: [
        ["inv-1", "INV-2025-0847", "Harbor Living LLC", 285000, "2025-05-15", "overdue", 9],
        ["inv-2", "INV-2025-0851", "Innovate Campus LLC", 142000, "2025-05-28", "sent", 0],
        ["inv-3", "INV-2025-0855", "Oak Valley School District", 98000, "2025-06-05", "sent", 0],
        ["inv-4", "INV-2025-0839", "Coastal Hospitality", 67500, "2025-04-30", "overdue", 24],
        ["inv-5", "INV-2025-0860", "Meridian Properties", 420000, "2025-06-15", "sent", 0],
        ["inv-6", "INV-2025-0822", "Golden Years Corp", 156000, "2025-04-15", "overdue", 39],
      ].map(([invoice_key, number, customer, amount, due_date, status, days_outstanding]) => ({
        organization_id: org, invoice_key, number, customer, amount, due_date, status, days_outstanding,
      })),
      conflict: "organization_id,invoice_key",
    },
    {
      name: "gcc_bills",
      rows: [
        ["bill-1", "Steel Supply Co", 86400, "2025-06-01", "pending", "Materials"],
        ["bill-2", "Premier Electric LLC", 42800, "2025-06-05", "pending", "Subcontractors"],
        ["bill-3", "Office Lease - Main St", 18500, "2025-06-01", "pending", "Rent"],
        ["bill-4", "Gusto Payroll", 186400, "2025-05-30", "pending", "Payroll"],
        ["bill-5", "First National Bank", 12500, "2025-06-15", "pending", "Loan Payment"],
        ["bill-6", "Concrete Masters Inc", 67200, "2025-05-20", "overdue", "Materials"],
      ].map(([bill_key, vendor, amount, due_date, status, category]) => ({
        organization_id: org, bill_key, vendor, amount, due_date, status, category,
      })),
      conflict: "organization_id,bill_key",
    },
    {
      name: "gcc_transactions",
      rows: [
        ["txn-1", "2025-05-22", "Harbor Living - Progress Payment", "Revenue", 142000, "income"],
        ["txn-2", "2025-05-21", "Steel Supply Co - Materials", "Materials", -86400, "expense"],
        ["txn-3", "2025-05-20", "Innovate Campus - Milestone 3", "Revenue", 98000, "income"],
        ["txn-4", "2025-05-19", "Premier Electric - Subcontractor", "Subcontractors", -42800, "expense"],
        ["txn-5", "2025-05-18", "Payroll - Bi-weekly", "Payroll", -186400, "expense"],
        ["txn-6", "2025-05-17", "Coastal Hospitality - Deposit", "Revenue", 38500, "income"],
        ["txn-7", "2025-05-16", "Equipment Rental", "Operating", -12400, "expense"],
        ["txn-8", "2025-05-15", "Insurance Premium", "Operating", -8900, "expense"],
      ].map(([txn_key, txn_date, description, category, amount, txn_type]) => ({
        organization_id: org, txn_key, txn_date, description, category, amount, txn_type,
      })),
      conflict: "organization_id,txn_key",
    },
    {
      name: "gcc_expense_categories",
      rows: [
        ["Labor", 298400, 33.4],
        ["Materials", 268200, 30.0],
        ["Subcontractors", 172800, 19.4],
        ["Payroll (Admin)", 98400, 11.0],
        ["Operating", 54600, 6.1],
      ].map(([category, amount, percent_of_revenue]) => ({
        organization_id: org, category, amount, percent_of_revenue,
      })),
      conflict: "organization_id,category",
    },
    {
      name: "gcc_revenue_sources",
      rows: [
        ["Commercial Construction", 534400, 59.9],
        ["Renovation & Fit-Out", 223100, 25.0],
        ["Service & Maintenance", 89400, 10.0],
        ["Change Orders", 45500, 5.1],
      ].map(([source, amount, percent]) => ({
        organization_id: org, source, amount, percent,
      })),
      conflict: "organization_id,source",
    },
    {
      name: "gcc_aging_buckets",
      rows: [
        ["ar", "Current", 726800, 12],
        ["ar", "1-30 Days", 384500, 5],
        ["ar", "31-60 Days", 98500, 2],
        ["ar", "61-90 Days", 36000, 1],
        ["ar", "90+ Days", 0, 0],
        ["ap", "Current", 412600, 8],
        ["ap", "1-30 Days", 198700, 4],
        ["ap", "31-60 Days", 67200, 1],
        ["ap", "61-90 Days", 8800, 1],
        ["ap", "90+ Days", 0, 0],
      ].map(([bucket_type, bucket, amount, count]) => ({
        organization_id: org, bucket_type, bucket, amount, count,
      })),
      conflict: "organization_id,bucket_type,bucket",
    },
  ];

  let v2Ok = true;
  for (const table of tables) {
    const { error } = await supabase.from(table.name).upsert(table.rows, { onConflict: table.conflict });
    if (error?.message?.includes("Could not find the table")) {
      v2Ok = false;
      break;
    }
    if (error) throw error;
  }

  if (v2Ok) {
    console.log("✅ v2 module data seeded (cash forecast, pipeline, jobs, etc.)");
  } else {
    console.warn("⚠️  v2 tables not found — run supabase/migration-v2.sql then npm run db:seed again");
  }
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e.message);
  process.exit(1);
});
