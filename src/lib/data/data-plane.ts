/**
 * Dual-mode data plane: Azure PG when AZURE_DATABASE_URL / DATABASE_URL is set,
 * otherwise Supabase admin client (default production path).
 */
import { isAzurePostgresConfigured, pgQuery } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/supabase/admin";

export type DataBackend = "azure-postgres" | "supabase";

export function resolveDataBackend(): DataBackend {
  return isAzurePostgresConfigured() ? "azure-postgres" : "supabase";
}

export function isAzureDataPlaneActive(): boolean {
  return isAzurePostgresConfigured();
}

/** Fail closed when a fetched row id does not match the requested organization. */
export function assertOrganizationIdMatch(
  requestedOrganizationId: string,
  rowOrganizationId: unknown
): boolean {
  if (!requestedOrganizationId?.trim()) return false;
  if (typeof rowOrganizationId !== "string") return false;
  return rowOrganizationId === requestedOrganizationId;
}

export async function fetchOrganizationRowById(
  organizationId: string
): Promise<Record<string, unknown> | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      "SELECT * FROM gcc_organizations WHERE id = $1 LIMIT 1",
      [organizationId]
    );
    const row = result.rows[0];
    if (!row) return null;
    if (!assertOrganizationIdMatch(organizationId, row.id)) return null;
    return row;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("gcc_organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  if (!assertOrganizationIdMatch(organizationId, (data as Record<string, unknown>).id)) {
    return null;
  }
  return data as Record<string, unknown>;
}

export async function fetchOrganizationSettingsById(
  organizationId: string
): Promise<{ settings: Record<string, unknown> } | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ id: string; settings: Record<string, unknown> | null }>(
      "SELECT id, settings FROM gcc_organizations WHERE id = $1 LIMIT 1",
      [organizationId]
    );
    const row = result.rows[0];
    if (!row || !assertOrganizationIdMatch(organizationId, row.id)) return null;
    return { settings: (row.settings as Record<string, unknown> | null) ?? {} };
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("gcc_organizations")
    .select("id, settings")
    .eq("id", organizationId)
    .single();

  if (error || !data) return null;
  if (!assertOrganizationIdMatch(organizationId, (data as Record<string, unknown>).id)) {
    return null;
  }

  return {
    settings: ((data as { settings?: Record<string, unknown> }).settings ?? {}) as Record<
      string,
      unknown
    >,
  };
}

export async function updateOrganizationById(
  organizationId: string,
  rowUpdate: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isAzureDataPlaneActive()) {
    const keys = Object.keys(rowUpdate);
    if (keys.length === 0) {
      return { ok: false, message: "No fields to update." };
    }

    const setClauses = keys.map((key, index) => `${key} = $${index + 2}`);
    const values = keys.map((key) => rowUpdate[key]);

    const result = await pgQuery<{ id: string }>(
      `UPDATE gcc_organizations SET ${setClauses.join(", ")} WHERE id = $1 RETURNING id`,
      [organizationId, ...values]
    );

    const updated = result.rows[0];
    if (!updated || !assertOrganizationIdMatch(organizationId, updated.id)) {
      return { ok: false, message: "Organization not found or tenant mismatch." };
    }

    return { ok: true };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, message: "Database admin client is not configured." };
  }

  const { data, error } = await admin
    .from("gcc_organizations")
    .update(rowUpdate)
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data || !assertOrganizationIdMatch(organizationId, (data as { id: string }).id)) {
    return { ok: false, message: "Organization not found or tenant mismatch." };
  }

  return { ok: true };
}

/** Tables read for dashboard primary aggregates (Azure PG dual-mode). */
export const DASHBOARD_AGGREGATE_TABLES = [
  "gcc_financial_snapshots",
  "gcc_monthly_trends",
  "gcc_budget_vs_actual",
  "gcc_kpis",
  "gcc_alerts",
] as const;

/** Additional tenant-only aggregate tables beyond dashboard bundle. */
export const TENANT_EXTENDED_AGGREGATE_TABLES = [
  "gcc_cash_forecast_weeks",
  "gcc_cash_forecast_months",
  "gcc_scenarios",
  "gcc_forecast_assumptions",
  "gcc_opportunities",
  "gcc_jobs",
  "gcc_invoices",
  "gcc_bills",
  "gcc_transactions",
  "gcc_expense_categories",
  "gcc_revenue_sources",
  "gcc_aging_buckets",
] as const;

export interface DashboardAggregateBundle {
  organizationDataSource: string | null;
  financialSnapshot: Record<string, unknown> | null;
  monthlyTrends: Record<string, unknown>[];
  budgetVsActual: Record<string, unknown>[];
  kpis: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
}

export interface TenantAggregateBundle extends DashboardAggregateBundle {
  organization: Record<string, unknown> | null;
  cashForecastWeeks: Record<string, unknown>[];
  cashForecastMonths: Record<string, unknown>[];
  scenarios: Record<string, unknown>[];
  forecastAssumptions: Record<string, unknown>[];
  opportunities: Record<string, unknown>[];
  jobs: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  expenseCategories: Record<string, unknown>[];
  revenueSources: Record<string, unknown>[];
  agingBuckets: Record<string, unknown>[];
}

/** Fail closed: keep only rows scoped to the requested organization. */
export function filterRowsByOrganizationId<T extends Record<string, unknown>>(
  requestedOrganizationId: string,
  rows: T[],
  column: "organization_id" | "id" = "organization_id"
): T[] {
  if (!requestedOrganizationId?.trim()) return [];
  return rows.filter((row) => assertOrganizationIdMatch(requestedOrganizationId, row[column]));
}

function tenantScopedRow(
  requestedOrganizationId: string,
  row: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!row) return null;
  if (!assertOrganizationIdMatch(requestedOrganizationId, row.organization_id)) return null;
  return row;
}

async function fetchTenantTableRows(
  organizationId: string,
  table: (typeof DASHBOARD_AGGREGATE_TABLES)[number] | (typeof TENANT_EXTENDED_AGGREGATE_TABLES)[number],
  orderBy?: string
): Promise<Record<string, unknown>[]> {
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";
  const result = await pgQuery<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE organization_id = $1${orderClause}`,
    [organizationId]
  );
  return filterRowsByOrganizationId(organizationId, result.rows);
}

async function fetchTenantSingleRow(
  organizationId: string,
  table: (typeof DASHBOARD_AGGREGATE_TABLES)[number] | "gcc_financial_snapshots"
): Promise<Record<string, unknown> | null> {
  const result = await pgQuery<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE organization_id = $1 LIMIT 1`,
    [organizationId]
  );
  return tenantScopedRow(organizationId, result.rows[0]);
}

export async function fetchDashboardAggregatesByOrganizationId(
  organizationId: string
): Promise<DashboardAggregateBundle | null> {
  if (!isAzureDataPlaneActive()) return null;
  if (!organizationId?.trim()) return null;

  const [orgResult, financialSnapshot, monthlyTrends, budgetVsActual, kpis, alerts] =
    await Promise.all([
      pgQuery<{ id: string; data_source: string | null }>(
        "SELECT id, data_source FROM gcc_organizations WHERE id = $1 LIMIT 1",
        [organizationId]
      ),
      fetchTenantSingleRow(organizationId, "gcc_financial_snapshots"),
      fetchTenantTableRows(organizationId, "gcc_monthly_trends", "sort_order"),
      fetchTenantTableRows(organizationId, "gcc_budget_vs_actual"),
      fetchTenantTableRows(organizationId, "gcc_kpis"),
      fetchTenantTableRows(organizationId, "gcc_alerts", "created_at DESC"),
    ]);

  const orgRow = orgResult.rows[0];
  const organizationDataSource =
    orgRow && assertOrganizationIdMatch(organizationId, orgRow.id)
      ? (orgRow.data_source ?? null)
      : null;

  return {
    organizationDataSource,
    financialSnapshot,
    monthlyTrends,
    budgetVsActual,
    kpis,
    alerts,
  };
}

export async function fetchTenantAggregatesByOrganizationId(
  organizationId: string
): Promise<TenantAggregateBundle | null> {
  if (!isAzureDataPlaneActive()) return null;
  if (!organizationId?.trim()) return null;

  const [
    dashboard,
    organization,
    cashForecastWeeks,
    cashForecastMonths,
    scenarios,
    forecastAssumptions,
    opportunities,
    jobs,
    invoices,
    bills,
    transactions,
    expenseCategories,
    revenueSources,
    agingBuckets,
  ] = await Promise.all([
    fetchDashboardAggregatesByOrganizationId(organizationId),
    fetchOrganizationRowById(organizationId),
    fetchTenantTableRows(organizationId, "gcc_cash_forecast_weeks", "week_num"),
    fetchTenantTableRows(organizationId, "gcc_cash_forecast_months"),
    fetchTenantTableRows(organizationId, "gcc_scenarios"),
    fetchTenantTableRows(organizationId, "gcc_forecast_assumptions"),
    fetchTenantTableRows(organizationId, "gcc_opportunities"),
    fetchTenantTableRows(organizationId, "gcc_jobs"),
    fetchTenantTableRows(organizationId, "gcc_invoices"),
    fetchTenantTableRows(organizationId, "gcc_bills"),
    fetchTenantTableRows(organizationId, "gcc_transactions", "txn_date DESC"),
    fetchTenantTableRows(organizationId, "gcc_expense_categories"),
    fetchTenantTableRows(organizationId, "gcc_revenue_sources"),
    fetchTenantTableRows(organizationId, "gcc_aging_buckets"),
  ]);

  if (!dashboard) return null;

  return {
    ...dashboard,
    organization,
    cashForecastWeeks,
    cashForecastMonths,
    scenarios,
    forecastAssumptions,
    opportunities,
    jobs,
    invoices,
    bills,
    transactions,
    expenseCategories,
    revenueSources,
    agingBuckets,
  };
}
