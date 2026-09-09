import { getTenantData } from "@/lib/mock-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import {
  fetchTenantAggregatesByOrganizationId,
  isAzureDataPlaneActive,
} from "@/lib/data/data-plane";
import { mapOrganizationRow } from "@/lib/data/organizations";
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

interface TenantAggregateRows {
  organization: Record<string, unknown> | null;
  snapshot: Record<string, unknown>;
  trends: Record<string, unknown>[];
  budget: Record<string, unknown>[];
  kpis: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  weeks: Record<string, unknown>[];
  months: Record<string, unknown>[];
  scenarios: Record<string, unknown>[];
  assumptions: Record<string, unknown>[];
  opportunities: Record<string, unknown>[];
  jobs: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  expense: Record<string, unknown>[];
  revenue: Record<string, unknown>[];
  aging: Record<string, unknown>[];
}

function buildTenantDataFromRows(mock: TenantData, rows: TenantAggregateRows): TenantData {
  const liveOrganization = rows.organization
    ? mapOrganizationRow(rows.organization)
    : mock.organization;

  const s = rows.snapshot;
  const arAging = rows.aging.filter((a) => a.bucket_type === "ar").map((a) => ({
    bucket: String(a.bucket),
    amount: Number(a.amount),
    count: Number(a.count),
  })) as ARAgingBucket[];
  const apAging = rows.aging.filter((a) => a.bucket_type === "ap").map((a) => ({
    bucket: String(a.bucket),
    amount: Number(a.amount),
    count: Number(a.count),
  })) as APAgingBucket[];

  return {
    ...mock,
    organization: liveOrganization,
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
    monthlyTrends: rows.trends.length
      ? rows.trends.map((r) => ({
          month: String(r.month),
          revenue: Number(r.revenue),
          expenses: Number(r.expenses),
          profit: Number(r.profit),
          cash: Number(r.cash),
        }))
      : mock.monthlyTrends,
    budgetVsActual: rows.budget.map((r) => ({
      category: String(r.category),
      budget: Number(r.budget),
      actual: Number(r.actual),
      variance: Number(r.variance),
      variancePercent: Number(r.variance_percent),
    })),
    kpis: rows.kpis.map((r) => ({
      id: String(r.kpi_key),
      name: String(r.name),
      value: Number(r.value),
      unit: r.unit as KPI["unit"],
      change: Number(r.change),
      changeLabel: (r.change_label as string | null) ?? "",
      target: r.target != null ? Number(r.target) : undefined,
      status: (r.status as KPI["status"]) ?? undefined,
      plan: (r.plan as string | null) ?? undefined,
      updatedAt: (r.updated_at as string | null) ?? undefined,
      manualOverride: (r.manual_override as boolean | null) ?? undefined,
    })),
    alerts: rows.alerts.map((r) => ({
      id: String(r.alert_key),
      title: String(r.title),
      description: String(r.description),
      severity: r.severity as AlertSeverity,
      recommendedAction: String(r.recommended_action),
      affectedMetric: String(r.affected_metric),
      dueDate: (r.due_date as string | null) ?? undefined,
      riskWindow: (r.risk_window as string | null) ?? undefined,
      owner: String(r.owner),
      isRead: Boolean(r.is_read),
      createdAt: String(r.created_at),
    })),
    cashForecastWeeks: rows.weeks.length
      ? rows.weeks.map((r) => ({
          week: Number(r.week_num),
          weekStart: String(r.week_start),
          weekEnd: String(r.week_end),
          startingBalance: Number(r.starting_balance),
          inflows: Number(r.inflows),
          outflows: Number(r.outflows),
          endingBalance: Number(r.ending_balance),
          isRiskPeriod: Boolean(r.is_risk_period),
        }))
      : mock.cashForecastWeeks,
    cashForecastMonths: rows.months.length
      ? rows.months.map((r) => ({
          month: String(r.month_label),
          inflows: Number(r.inflows),
          outflows: Number(r.outflows),
          endingBalance: Number(r.ending_balance),
          isRiskPeriod: Boolean(r.is_risk_period),
        }))
      : mock.cashForecastMonths,
    scenarios: rows.scenarios.length
      ? rows.scenarios.map((r) => ({
          id: String(r.scenario_key),
          name: String(r.name),
          type: r.scenario_type as Scenario["type"],
          revenueGrowthRate: Number(r.revenue_growth_rate),
          collectionTimingDays: Number(r.collection_timing_days),
          expenseIncreaseRate: Number(r.expense_increase_rate),
          endingCash: Number(r.ending_cash),
          minimumCash: Number(r.minimum_cash),
          runway: Number(r.runway),
          description: (r.description as string | null) ?? "",
        }))
      : mock.scenarios,
    forecastAssumptions: rows.assumptions.length
      ? rows.assumptions.map((r) => ({
          id: String(r.assumption_key),
          category: String(r.category),
          type: r.assumption_type as ForecastAssumption["type"],
          amount: Number(r.amount),
          frequency: r.frequency as ForecastAssumption["frequency"],
          startDate: String(r.start_date),
          notes: (r.notes as string | null) ?? undefined,
        }))
      : mock.forecastAssumptions,
    opportunities: rows.opportunities.length
      ? rows.opportunities.map((r) => ({
          id: String(r.opp_key),
          name: String(r.name),
          customer: String(r.customer),
          stage: r.stage as DealStage,
          probability: Number(r.probability),
          value: Number(r.value),
          expectedCloseDate: String(r.expected_close_date),
          rep: String(r.rep),
          source: String(r.source),
          weightedValue: Number(r.weighted_value),
        }))
      : mock.opportunities,
    jobs: rows.jobs.length
      ? rows.jobs.map((r) => ({
          id: String(r.job_key),
          name: String(r.name),
          customer: String(r.customer),
          status: r.status as JobStatus,
          contractValue: Number(r.contract_value),
          estimatedGrossMargin: Number(r.estimated_gross_margin),
          actualGrossMargin: Number(r.actual_gross_margin),
          laborCost: Number(r.labor_cost),
          materialCost: Number(r.material_cost),
          subcontractorCost: Number(r.subcontractor_cost),
          completionPercent: Number(r.completion_percent),
          expectedBillingDate: String(r.expected_billing_date),
          expectedCollectionDate: String(r.expected_collection_date),
          projectManager: String(r.project_manager),
        }))
      : mock.jobs,
    invoices: rows.invoices.length
      ? rows.invoices.map((r) => ({
          id: String(r.invoice_key),
          number: String(r.number),
          customer: String(r.customer),
          amount: Number(r.amount),
          dueDate: String(r.due_date),
          status: r.status as Invoice["status"],
          daysOutstanding: Number(r.days_outstanding),
        }))
      : mock.invoices,
    bills: rows.bills.length
      ? rows.bills.map((r) => ({
          id: String(r.bill_key),
          vendor: String(r.vendor),
          amount: Number(r.amount),
          dueDate: String(r.due_date),
          status: r.status as Bill["status"],
          category: String(r.category),
        }))
      : mock.bills,
    transactions: rows.transactions.length
      ? rows.transactions.map((r) => ({
          id: String(r.txn_key),
          date: String(r.txn_date),
          description: String(r.description),
          category: String(r.category),
          amount: Number(r.amount),
          type: r.txn_type as Transaction["type"],
        }))
      : mock.transactions,
    expenseCategories: rows.expense.length
      ? rows.expense.map((r) => ({
          category: String(r.category),
          amount: Number(r.amount),
          percentOfRevenue: Number(r.percent_of_revenue),
        }))
      : mock.expenseCategories,
    revenueSources: rows.revenue.length
      ? rows.revenue.map((r) => ({
          source: String(r.source),
          amount: Number(r.amount),
          percent: Number(r.percent),
        }))
      : mock.revenueSources,
    arAging: arAging.length ? arAging : mock.arAging,
    apAging: apAging.length ? apAging : mock.apAging,
  };
}

export async function getFullTenantData(organizationId: string): Promise<TenantDataResult> {
  const mock = getTenantData(organizationId);

  if (isAzureDataPlaneActive()) {
    const bundle = await fetchTenantAggregatesByOrganizationId(organizationId);
    if (!bundle?.financialSnapshot) {
      return { data: mock, source: "mock" };
    }

    return {
      data: buildTenantDataFromRows(mock, {
        organization: bundle.organization,
        snapshot: bundle.financialSnapshot,
        trends: bundle.monthlyTrends,
        budget: bundle.budgetVsActual,
        kpis: bundle.kpis,
        alerts: bundle.alerts,
        weeks: bundle.cashForecastWeeks,
        months: bundle.cashForecastMonths,
        scenarios: bundle.scenarios,
        assumptions: bundle.forecastAssumptions,
        opportunities: bundle.opportunities,
        jobs: bundle.jobs,
        invoices: bundle.invoices,
        bills: bundle.bills,
        transactions: bundle.transactions,
        expense: bundle.expenseCategories,
        revenue: bundle.revenueSources,
        aging: bundle.agingBuckets,
      }),
      source: "supabase",
    };
  }

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
    orgRes,
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
    db.from("gcc_organizations").select("*").eq("id", orgId).maybeSingle(),
  ]);

  const liveOrganization = orgRes.data
    ? mapOrganizationRow(orgRes.data as Record<string, unknown>)
    : mock.organization;

  if (snapshotRes.error || !snapshotRes.data) {
    return { data: { ...mock, organization: liveOrganization }, source: "mock" };
  }

  return {
    data: buildTenantDataFromRows(mock, {
      organization: orgRes.data as Record<string, unknown>,
      snapshot: snapshotRes.data as Record<string, unknown>,
      trends: (trendsRes.data ?? []) as Record<string, unknown>[],
      budget: (budgetRes.data ?? []) as Record<string, unknown>[],
      kpis: (kpisRes.data ?? []) as Record<string, unknown>[],
      alerts: (alertsRes.data ?? []) as Record<string, unknown>[],
      weeks: (weeksRes.data ?? []) as Record<string, unknown>[],
      months: (monthsRes.data ?? []) as Record<string, unknown>[],
      scenarios: (scenariosRes.data ?? []) as Record<string, unknown>[],
      assumptions: (assumptionsRes.data ?? []) as Record<string, unknown>[],
      opportunities: (oppsRes.data ?? []) as Record<string, unknown>[],
      jobs: (jobsRes.data ?? []) as Record<string, unknown>[],
      invoices: (invoicesRes.data ?? []) as Record<string, unknown>[],
      bills: (billsRes.data ?? []) as Record<string, unknown>[],
      transactions: (txnsRes.data ?? []) as Record<string, unknown>[],
      expense: (expenseRes.data ?? []) as Record<string, unknown>[],
      revenue: (revenueRes.data ?? []) as Record<string, unknown>[],
      aging: (agingRes.data ?? []) as Record<string, unknown>[],
    }),
    source: "supabase",
  };
}
