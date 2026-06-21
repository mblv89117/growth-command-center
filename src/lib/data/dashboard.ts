import { getTenantData } from "@/lib/mock-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import type {
  Alert,
  AlertSeverity,
  BudgetVsActual,
  FinancialSnapshot,
  KPI,
  MonthlyTrend,
  TenantData,
} from "@/lib/types";

export interface DashboardData {
  financialSnapshot: FinancialSnapshot;
  monthlyTrends: MonthlyTrend[];
  budgetVsActual: BudgetVsActual[];
  kpis: KPI[];
  alerts: Alert[];
  source: "supabase" | "mock";
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

async function fetchFromSupabase(
  organizationId: string,
  useAdmin: boolean
): Promise<DashboardData | null> {
  const supabase = useAdmin ? createAdminClient() : await createClient();
  if (!supabase) return null;

  const [snapshotRes, trendsRes, budgetRes, kpisRes, alertsRes] = await Promise.all([
    supabase.from("gcc_financial_snapshots").select("*").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("gcc_monthly_trends").select("*").eq("organization_id", organizationId).order("sort_order"),
    supabase.from("gcc_budget_vs_actual").select("*").eq("organization_id", organizationId),
    supabase.from("gcc_kpis").select("*").eq("organization_id", organizationId),
    supabase.from("gcc_alerts").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
  ]);

  if (snapshotRes.error || !snapshotRes.data) return null;

  return {
    financialSnapshot: mapFinancialSnapshot(snapshotRes.data),
    monthlyTrends: (trendsRes.data ?? []).map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      expenses: Number(r.expenses),
      profit: Number(r.profit),
      cash: Number(r.cash),
    })),
    budgetVsActual: (budgetRes.data ?? []).map((r) => ({
      category: r.category,
      budget: Number(r.budget),
      actual: Number(r.actual),
      variance: Number(r.variance),
      variancePercent: Number(r.variance_percent),
    })),
    kpis: (kpisRes.data ?? []).map((r) => ({
      id: r.kpi_key,
      name: r.name,
      value: Number(r.value),
      unit: r.unit as KPI["unit"],
      change: Number(r.change),
      changeLabel: r.change_label ?? "",
      target: r.target != null ? Number(r.target) : undefined,
      status: (r.status as KPI["status"]) ?? undefined,
      plan: r.plan ?? undefined,
      updatedAt: r.updated_at ?? undefined,
      manualOverride: r.manual_override ?? undefined,
    })),
    alerts: (alertsRes.data ?? []).map((r) => ({
      id: r.alert_key,
      title: r.title,
      description: r.description,
      severity: r.severity as AlertSeverity,
      recommendedAction: r.recommended_action,
      affectedMetric: r.affected_metric,
      dueDate: r.due_date ?? undefined,
      riskWindow: r.risk_window ?? undefined,
      owner: r.owner,
      isRead: r.is_read,
      createdAt: r.created_at,
    })),
    source: "supabase",
  };
}

export async function getDashboardData(organizationId: string): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    const mock = getTenantData(organizationId);
    return {
      financialSnapshot: mock.financialSnapshot,
      monthlyTrends: mock.monthlyTrends,
      budgetVsActual: mock.budgetVsActual,
      kpis: mock.kpis,
      alerts: mock.alerts,
      source: "mock",
    };
  }

  // Try user-scoped client first (authenticated), then admin (demo/server)
  const userScoped = await fetchFromSupabase(organizationId, false);
  if (userScoped) return userScoped;

  const adminScoped = await fetchFromSupabase(organizationId, true);
  if (adminScoped) return adminScoped;

  const mock = getTenantData(organizationId);
  return {
    financialSnapshot: mock.financialSnapshot,
    monthlyTrends: mock.monthlyTrends,
    budgetVsActual: mock.budgetVsActual,
    kpis: mock.kpis,
    alerts: mock.alerts,
    source: "mock",
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
