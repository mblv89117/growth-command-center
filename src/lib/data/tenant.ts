import { getTenantData } from "@/lib/mock-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import type {
  AlertSeverity,
  APAgingBucket,
  ARAgingBucket,
  Bill,
  ForecastAssumption,
  Invoice,
  JobStatus,
  KPI,
  Scenario,
  TenantData,
  Transaction,
  DealStage,
} from "@/lib/types";

export interface TenantDataResult {
  data: TenantData;
  source: "supabase" | "mock";
}

export async function getFullTenantData(organizationId: string): Promise<TenantDataResult> {
  const mock = getTenantData(organizationId);

  if (!isSupabaseConfigured()) {
    return { data: mock, source: "mock" };
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { data: mock, source: "mock" };

  const orgId = organizationId;

  const [
    snapshotRes,
    trendsRes,
    budgetRes,
    kpisRes,
    alertsRes,
    weeksRes,
    monthsRes,
    scenariosRes,
    assumptionsRes,
    oppsRes,
    jobsRes,
    invoicesRes,
    billsRes,
    txnsRes,
    expenseRes,
    revenueRes,
    agingRes,
  ] = await Promise.all([
    db.from("gcc_financial_snapshots").select("*").eq("organization_id", orgId).maybeSingle(),
    db.from("gcc_monthly_trends").select("*").eq("organization_id", orgId).order("sort_order"),
    db.from("gcc_budget_vs_actual").select("*").eq("organization_id", orgId),
    db.from("gcc_kpis").select("*").eq("organization_id", orgId),
    db.from("gcc_alerts").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    db.from("gcc_cash_forecast_weeks").select("*").eq("organization_id", orgId).order("week_num"),
    db.from("gcc_cash_forecast_months").select("*").eq("organization_id", orgId),
    db.from("gcc_scenarios").select("*").eq("organization_id", orgId),
    db.from("gcc_forecast_assumptions").select("*").eq("organization_id", orgId),
    db.from("gcc_opportunities").select("*").eq("organization_id", orgId),
    db.from("gcc_jobs").select("*").eq("organization_id", orgId),
    db.from("gcc_invoices").select("*").eq("organization_id", orgId),
    db.from("gcc_bills").select("*").eq("organization_id", orgId),
    db.from("gcc_transactions").select("*").eq("organization_id", orgId).order("txn_date", { ascending: false }),
    db.from("gcc_expense_categories").select("*").eq("organization_id", orgId),
    db.from("gcc_revenue_sources").select("*").eq("organization_id", orgId),
    db.from("gcc_aging_buckets").select("*").eq("organization_id", orgId),
  ]);

  if (snapshotRes.error || !snapshotRes.data) {
    return { data: mock, source: "mock" };
  }

  const s = snapshotRes.data;
  const arAging = (agingRes.data ?? []).filter((a) => a.bucket_type === "ar").map((a) => ({
    bucket: a.bucket, amount: Number(a.amount), count: a.count,
  })) as ARAgingBucket[];
  const apAging = (agingRes.data ?? []).filter((a) => a.bucket_type === "ap").map((a) => ({
    bucket: a.bucket, amount: Number(a.amount), count: a.count,
  })) as APAgingBucket[];

  const data: TenantData = {
    ...mock,
    organization: mock.organization,
    financialSnapshot: {
      currentCash: Number(s.current_cash),
      forecastedCash: Number(s.forecasted_cash),
      revenueMTD: Number(s.revenue_mtd),
      revenueYTD: Number(s.revenue_ytd),
      grossProfit: Number(s.gross_profit),
      netProfit: Number(s.net_profit),
      operatingExpenses: Number(s.operating_expenses),
      accountsReceivable: Number(s.accounts_receivable),
      accountsPayable: Number(s.accounts_payable),
      burnRate: Number(s.burn_rate),
      runway: Number(s.runway),
      debtObligations: Number(s.debt_obligations),
      payrollObligations: Number(s.payroll_obligations),
      ebitda: Number(s.ebitda),
    },
    monthlyTrends: (trendsRes.data ?? []).length
      ? (trendsRes.data ?? []).map((r) => ({
          month: r.month, revenue: Number(r.revenue), expenses: Number(r.expenses),
          profit: Number(r.profit), cash: Number(r.cash),
        }))
      : mock.monthlyTrends,
    budgetVsActual: (budgetRes.data ?? []).map((r) => ({
      category: r.category, budget: Number(r.budget), actual: Number(r.actual),
      variance: Number(r.variance), variancePercent: Number(r.variance_percent),
    })),
    kpis: (kpisRes.data ?? []).map((r) => ({
      id: r.kpi_key, name: r.name, value: Number(r.value), unit: r.unit as KPI["unit"],
      change: Number(r.change), changeLabel: r.change_label ?? "", target: r.target != null ? Number(r.target) : undefined,
    })),
    alerts: (alertsRes.data ?? []).map((r) => ({
      id: r.alert_key, title: r.title, description: r.description,
      severity: r.severity as AlertSeverity, recommendedAction: r.recommended_action,
      affectedMetric: r.affected_metric, dueDate: r.due_date ?? undefined,
      riskWindow: r.risk_window ?? undefined, owner: r.owner, isRead: r.is_read,
      createdAt: r.created_at,
    })),
    cashForecastWeeks: (weeksRes.data ?? []).length
      ? (weeksRes.data ?? []).map((r) => ({
          week: r.week_num, weekStart: r.week_start, weekEnd: r.week_end,
          startingBalance: Number(r.starting_balance), inflows: Number(r.inflows),
          outflows: Number(r.outflows), endingBalance: Number(r.ending_balance),
          isRiskPeriod: r.is_risk_period,
        }))
      : mock.cashForecastWeeks,
    cashForecastMonths: (monthsRes.data ?? []).length
      ? (monthsRes.data ?? []).map((r) => ({
          month: r.month_label, inflows: Number(r.inflows), outflows: Number(r.outflows),
          endingBalance: Number(r.ending_balance), isRiskPeriod: r.is_risk_period,
        }))
      : mock.cashForecastMonths,
    scenarios: (scenariosRes.data ?? []).length
      ? (scenariosRes.data ?? []).map((r) => ({
          id: r.scenario_key, name: r.name, type: r.scenario_type as Scenario["type"],
          revenueGrowthRate: Number(r.revenue_growth_rate), collectionTimingDays: r.collection_timing_days,
          expenseIncreaseRate: Number(r.expense_increase_rate), endingCash: Number(r.ending_cash),
          minimumCash: Number(r.minimum_cash), runway: Number(r.runway), description: r.description ?? "",
        }))
      : mock.scenarios,
    forecastAssumptions: (assumptionsRes.data ?? []).length
      ? (assumptionsRes.data ?? []).map((r) => ({
          id: r.assumption_key, category: r.category, type: r.assumption_type as ForecastAssumption["type"],
          amount: Number(r.amount), frequency: r.frequency as ForecastAssumption["frequency"],
          startDate: r.start_date, notes: r.notes ?? undefined,
        }))
      : mock.forecastAssumptions,
    opportunities: (oppsRes.data ?? []).length
      ? (oppsRes.data ?? []).map((r) => ({
          id: r.opp_key, name: r.name, customer: r.customer, stage: r.stage as DealStage,
          probability: r.probability, value: Number(r.value), expectedCloseDate: r.expected_close_date,
          rep: r.rep, source: r.source, weightedValue: Number(r.weighted_value),
        }))
      : mock.opportunities,
    jobs: (jobsRes.data ?? []).length
      ? (jobsRes.data ?? []).map((r) => ({
          id: r.job_key, name: r.name, customer: r.customer, status: r.status as JobStatus,
          contractValue: Number(r.contract_value), estimatedGrossMargin: Number(r.estimated_gross_margin),
          actualGrossMargin: Number(r.actual_gross_margin), laborCost: Number(r.labor_cost),
          materialCost: Number(r.material_cost), subcontractorCost: Number(r.subcontractor_cost),
          completionPercent: r.completion_percent, expectedBillingDate: r.expected_billing_date,
          expectedCollectionDate: r.expected_collection_date, projectManager: r.project_manager,
        }))
      : mock.jobs,
    invoices: (invoicesRes.data ?? []).length
      ? (invoicesRes.data ?? []).map((r) => ({
          id: r.invoice_key, number: r.number, customer: r.customer, amount: Number(r.amount),
          dueDate: r.due_date, status: r.status as Invoice["status"], daysOutstanding: r.days_outstanding,
        }))
      : mock.invoices,
    bills: (billsRes.data ?? []).length
      ? (billsRes.data ?? []).map((r) => ({
          id: r.bill_key, vendor: r.vendor, amount: Number(r.amount), dueDate: r.due_date,
          status: r.status as Bill["status"], category: r.category,
        }))
      : mock.bills,
    transactions: (txnsRes.data ?? []).length
      ? (txnsRes.data ?? []).map((r) => ({
          id: r.txn_key, date: r.txn_date, description: r.description, category: r.category,
          amount: Number(r.amount), type: r.txn_type as Transaction["type"],
        }))
      : mock.transactions,
    expenseCategories: (expenseRes.data ?? []).length
      ? (expenseRes.data ?? []).map((r) => ({
          category: r.category, amount: Number(r.amount), percentOfRevenue: Number(r.percent_of_revenue),
        }))
      : mock.expenseCategories,
    revenueSources: (revenueRes.data ?? []).length
      ? (revenueRes.data ?? []).map((r) => ({
          source: r.source, amount: Number(r.amount), percent: Number(r.percent),
        }))
      : mock.revenueSources,
    arAging: arAging.length ? arAging : mock.arAging,
    apAging: apAging.length ? apAging : mock.apAging,
  };

  return { data, source: "supabase" };
}
