import { getTenantData } from "@/lib/mock-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import {
  fetchDashboardAggregatesByOrganizationId,
  isAzureDataPlaneActive,
} from "@/lib/data/data-plane";
import { computeDashboardDeltas, computeWorkingCapital, type DashboardDeltas } from "@/lib/financial/deltas";
import type {
  Alert,
  AlertSeverity,
  BudgetVsActual,
  FinancialSnapshot,
  KPI,
  MonthlyTrend,
  TenantData,
} from "@/lib/types";

const DEMO_ORG_IDS = new Set(["org-apex", "org-summit"]);

function resolveDataProvenance(
  organizationId: string,
  dataSource: string | null | undefined
): DashboardData["dataProvenance"] {
  if (DEMO_ORG_IDS.has(organizationId)) return "seeded";
  if (dataSource === "imported") return "imported";
  if (dataSource === "computed") return "computed";
  if (!dataSource || dataSource === "empty") return "empty";
  return "imported";
}

export interface DashboardData {
  financialSnapshot: FinancialSnapshot;
  monthlyTrends: MonthlyTrend[];
  budgetVsActual: BudgetVsActual[];
  kpis: KPI[];
  alerts: Alert[];
  source: "supabase" | "mock";
  /** Tenant data provenance for UI labels */
  dataProvenance?: "empty" | "imported" | "computed" | "seeded" | "mock";
  deltas?: DashboardDeltas;
  workingCapital?: number;
  forecastVariancePercent?: number;
}

function mapFinancialSnapshot(row: Record<string, unknown>): FinancialSnapshot {
  return {
    currentCash: Number(row.current_cash),
    forecastedCash: Number(row.forecasted_cash),
    revenueMTD: Number(row.revenue_mtd),
    revenueYTD: Number(row.revenue_ytd),
    grossProfit: Number(row.gross_profit),
    netProfit: Number(row.net_profit),
    operatingExpenses: Number(row.operating_expenses),
    accountsReceivable: Number(row.accounts_receivable),
    accountsPayable: Number(row.accounts_payable),
    burnRate: Number(row.burn_rate),
    runway: Number(row.runway),
    debtObligations: Number(row.debt_obligations),
    payrollObligations: Number(row.payroll_obligations),
    ebitda: Number(row.ebitda),
  };
}

function mapRowsToDashboardData(
  organizationId: string,
  orgDataSource: string | null | undefined,
  snapshot: Record<string, unknown>,
  trendsRows: Record<string, unknown>[],
  budgetRows: Record<string, unknown>[],
  kpiRows: Record<string, unknown>[],
  alertRows: Record<string, unknown>[]
): DashboardData {
  const monthlyTrends = trendsRows.map((r) => ({
    month: String(r.month),
    revenue: Number(r.revenue),
    expenses: Number(r.expenses),
    profit: Number(r.profit),
    cash: Number(r.cash),
  }));
  const financialSnapshot = mapFinancialSnapshot(snapshot);

  return {
    financialSnapshot,
    monthlyTrends,
    budgetVsActual: budgetRows.map((r) => ({
      category: String(r.category),
      budget: Number(r.budget),
      actual: Number(r.actual),
      variance: Number(r.variance),
      variancePercent: Number(r.variance_percent),
    })),
    kpis: kpiRows.map((r) => ({
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
    alerts: alertRows.map((r) => ({
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
    source: "supabase" as const,
    dataProvenance: resolveDataProvenance(organizationId, orgDataSource ?? undefined),
    deltas: computeDashboardDeltas(financialSnapshot, monthlyTrends),
    workingCapital: computeWorkingCapital(financialSnapshot),
    forecastVariancePercent:
      financialSnapshot.currentCash > 0
        ? Math.round(
            ((financialSnapshot.forecastedCash - financialSnapshot.currentCash) /
              financialSnapshot.currentCash) *
              1000
          ) / 10
        : 0,
  };
}

async function fetchFromAzure(organizationId: string): Promise<DashboardData | null> {
  const bundle = await fetchDashboardAggregatesByOrganizationId(organizationId);
  if (!bundle?.financialSnapshot) return null;

  return mapRowsToDashboardData(
    organizationId,
    bundle.organizationDataSource,
    bundle.financialSnapshot,
    bundle.monthlyTrends,
    bundle.budgetVsActual,
    bundle.kpis,
    bundle.alerts
  );
}

async function fetchFromSupabase(
  organizationId: string,
  useAdmin: boolean
): Promise<DashboardData | null> {
  const supabase = useAdmin ? createAdminClient() : await createClient();
  if (!supabase) return null;

  const [orgRes, snapshotRes, trendsRes, budgetRes, kpisRes, alertsRes] = await Promise.all([
    supabase.from("gcc_organizations").select("data_source").eq("id", organizationId).maybeSingle(),
    supabase.from("gcc_financial_snapshots").select("*").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("gcc_monthly_trends").select("*").eq("organization_id", organizationId).order("sort_order"),
    supabase.from("gcc_budget_vs_actual").select("*").eq("organization_id", organizationId),
    supabase.from("gcc_kpis").select("*").eq("organization_id", organizationId),
    supabase.from("gcc_alerts").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
  ]);

  if (snapshotRes.error || !snapshotRes.data) return null;

  return mapRowsToDashboardData(
    organizationId,
    orgRes.data?.data_source as string | undefined,
    snapshotRes.data as Record<string, unknown>,
    (trendsRes.data ?? []) as Record<string, unknown>[],
    (budgetRes.data ?? []) as Record<string, unknown>[],
    (kpisRes.data ?? []) as Record<string, unknown>[],
    (alertsRes.data ?? []) as Record<string, unknown>[]
  );
}

export async function getDashboardData(organizationId: string): Promise<DashboardData> {
  if (isAzureDataPlaneActive()) {
    const azure = await fetchFromAzure(organizationId);
    if (azure) return azure;
  } else if (isSupabaseConfigured()) {
    const userScoped = await fetchFromSupabase(organizationId, false);
    if (userScoped) return userScoped;

    const adminScoped = await fetchFromSupabase(organizationId, true);
    if (adminScoped) return adminScoped;
  }

  const mock = getTenantData(organizationId);
  const deltas = computeDashboardDeltas(mock.financialSnapshot, mock.monthlyTrends);
  return {
    financialSnapshot: mock.financialSnapshot,
    monthlyTrends: mock.monthlyTrends,
    budgetVsActual: mock.budgetVsActual,
    kpis: mock.kpis,
    alerts: mock.alerts,
    source: "mock",
    dataProvenance: "mock",
    deltas,
    workingCapital: computeWorkingCapital(mock.financialSnapshot),
    forecastVariancePercent:
      mock.financialSnapshot.currentCash > 0
        ? Math.round(
            ((mock.financialSnapshot.forecastedCash - mock.financialSnapshot.currentCash) /
              mock.financialSnapshot.currentCash) *
              1000
          ) / 10
        : 0,
  };
}

export async function getTenantDataWithFallback(organizationId: string): Promise<TenantData & { dataSource: string }> {
  const mock = getTenantData(organizationId);
  const dashboard = await getDashboardData(organizationId);

  if (dashboard.source === "mock") {
    return { ...mock, dataSource: "mock" };
  }

  return {
    ...mock,
    financialSnapshot: dashboard.financialSnapshot,
    monthlyTrends: dashboard.monthlyTrends,
    budgetVsActual: dashboard.budgetVsActual,
    kpis: dashboard.kpis,
    alerts: dashboard.alerts,
    dataSource: "supabase",
  };
}

export async function verifySupabaseConnection(): Promise<{
  ok: boolean;
  configured: boolean;
  adminReady: boolean;
  organizations?: number;
  message: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, configured: false, adminReady: false, message: "Supabase env vars not set" };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      configured: true,
      adminReady: false,
      message: "SUPABASE_SERVICE_ROLE_KEY missing or invalid — add the service_role JWT from Supabase dashboard",
    };
  }

  const { count, error } = await admin.from("gcc_organizations").select("*", { count: "exact", head: true });

  if (error) {
    return {
      ok: false,
      configured: true,
      adminReady: true,
      message: `Database error: ${error.message}. Run supabase/setup.sql in Supabase SQL Editor, then npm run db:seed`,
    };
  }

  return {
    ok: true,
    configured: true,
    adminReady: true,
    organizations: count ?? 0,
    message: count ? "Supabase connected and seeded" : "Connected but no data — run: npm run db:setup",
  };
}
