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

/** True when Azure PG or Supabase admin can persist data. */
export function isPersistentDataBackendAvailable(): boolean {
  return isAzureDataPlaneActive() || Boolean(createAdminClient());
}

// --- KPI dual-mode ---

export async function fetchKpiRowByKey(
  organizationId: string,
  kpiKey: string
): Promise<Record<string, unknown> | null> {
  if (!organizationId?.trim() || !kpiKey?.trim()) return null;

  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      "SELECT * FROM gcc_kpis WHERE organization_id = $1 AND kpi_key = $2 LIMIT 1",
      [organizationId, kpiKey]
    );
    return tenantScopedRow(organizationId, result.rows[0]);
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("gcc_kpis")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("kpi_key", kpiKey)
    .maybeSingle();

  if (error || !data) return null;
  if (
    !assertOrganizationIdMatch(
      organizationId,
      (data as Record<string, unknown>).organization_id
    )
  ) {
    return null;
  }
  return data as Record<string, unknown>;
}

export async function updateKpiRowByKey(
  organizationId: string,
  kpiKey: string,
  rowPatch: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  if (!organizationId?.trim() || !kpiKey?.trim()) return null;

  if (isAzureDataPlaneActive()) {
    const keys = Object.keys(rowPatch);
    if (keys.length === 0) return fetchKpiRowByKey(organizationId, kpiKey);

    const setClauses = keys.map((key, index) => `${key} = $${index + 3}`);
    const values = keys.map((key) => rowPatch[key]);

    const result = await pgQuery<Record<string, unknown>>(
      `UPDATE gcc_kpis SET ${setClauses.join(", ")} WHERE organization_id = $1 AND kpi_key = $2 RETURNING *`,
      [organizationId, kpiKey, ...values]
    );
    return tenantScopedRow(organizationId, result.rows[0]);
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("gcc_kpis")
    .update(rowPatch)
    .eq("organization_id", organizationId)
    .eq("kpi_key", kpiKey)
    .select("*")
    .single();

  if (error || !data) return null;
  if (
    !assertOrganizationIdMatch(
      organizationId,
      (data as Record<string, unknown>).organization_id
    )
  ) {
    return null;
  }
  return data as Record<string, unknown>;
}

export async function upsertKpiRow(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (!organizationId?.trim()) return;

  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_kpis (organization_id, kpi_key, name, value, unit, change, target, status, manual_override, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (organization_id, kpi_key) DO UPDATE SET
         name = EXCLUDED.name,
         value = EXCLUDED.value,
         unit = EXCLUDED.unit,
         change = EXCLUDED.change,
         target = EXCLUDED.target,
         status = EXCLUDED.status,
         manual_override = EXCLUDED.manual_override,
         updated_at = EXCLUDED.updated_at`,
      [
        organizationId,
        row.kpi_key,
        row.name,
        row.value,
        row.unit,
        row.change,
        row.target,
        row.status,
        row.manual_override,
        row.updated_at,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("gcc_kpis").upsert(row, { onConflict: "organization_id,kpi_key" });
}

export async function fetchKpiKeysWithTargets(
  organizationId: string,
  kpiKeys: readonly string[]
): Promise<string[]> {
  if (!organizationId?.trim() || kpiKeys.length === 0) return [];

  if (isAzureDataPlaneActive()) {
    const placeholders = kpiKeys.map((_, index) => `$${index + 2}`).join(", ");
    const result = await pgQuery<{ kpi_key: string; target: unknown; organization_id: string }>(
      `SELECT kpi_key, target, organization_id FROM gcc_kpis
       WHERE organization_id = $1 AND kpi_key IN (${placeholders})`,
      [organizationId, ...kpiKeys]
    );
    return filterRowsByOrganizationId(organizationId, result.rows)
      .filter((row) => row.target != null)
      .map((row) => row.kpi_key as string);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_kpis")
    .select("kpi_key, target, organization_id")
    .eq("organization_id", organizationId)
    .in("kpi_key", [...kpiKeys]);

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[])
    .filter((row) => row.target != null)
    .map((row) => row.kpi_key as string);
}

// --- Onboarding dual-mode ---

export async function fetchOnboardingMessagesByOrganizationId(
  organizationId: string
): Promise<Record<string, unknown>[]> {
  if (!organizationId?.trim()) return [];

  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      `SELECT id, role, content, created_at, organization_id FROM gcc_onboarding_messages
       WHERE organization_id = $1 ORDER BY created_at ASC`,
      [organizationId]
    );
    return filterRowsByOrganizationId(organizationId, result.rows);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_onboarding_messages")
    .select("id, role, content, created_at, organization_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[]);
}

export async function insertOnboardingMessage(
  organizationId: string,
  role: string,
  content: string
): Promise<Record<string, unknown> | null> {
  if (!organizationId?.trim()) return null;

  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      `INSERT INTO gcc_onboarding_messages (organization_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING id, role, content, created_at, organization_id`,
      [organizationId, role, content]
    );
    return tenantScopedRow(organizationId, result.rows[0]);
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("gcc_onboarding_messages")
    .insert({ organization_id: organizationId, role, content })
    .select("id, role, content, created_at, organization_id")
    .single();

  if (error || !data) return null;
  if (
    !assertOrganizationIdMatch(
      organizationId,
      (data as Record<string, unknown>).organization_id
    )
  ) {
    return null;
  }
  return data as Record<string, unknown>;
}

// --- Integration connections dual-mode ---

export async function fetchIntegrationConnection(
  organizationId: string,
  provider: string
): Promise<Record<string, unknown> | null> {
  if (!organizationId?.trim() || !provider?.trim()) return null;

  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      `SELECT * FROM gcc_integration_connections
       WHERE organization_id = $1 AND provider = $2 LIMIT 1`,
      [organizationId, provider]
    );
    return tenantScopedRow(organizationId, result.rows[0]);
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_integration_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data) return null;
  if (
    !assertOrganizationIdMatch(
      organizationId,
      (data as Record<string, unknown>).organization_id
    )
  ) {
    return null;
  }
  return data as Record<string, unknown>;
}

export async function fetchIntegrationConnectionsByOrganizationId(
  organizationId: string
): Promise<Record<string, unknown>[]> {
  if (!organizationId?.trim()) return [];

  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      "SELECT * FROM gcc_integration_connections WHERE organization_id = $1",
      [organizationId]
    );
    return filterRowsByOrganizationId(organizationId, result.rows);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_integration_connections")
    .select("*")
    .eq("organization_id", organizationId);

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[]);
}

export async function upsertIntegrationConnectionRow(
  row: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const organizationId = row.organization_id as string | undefined;
  if (!organizationId?.trim()) return null;

  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      `INSERT INTO gcc_integration_connections (
         organization_id, provider, status, access_token, refresh_token, realm_id,
         connected_at, last_sync, error_message, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (organization_id, provider) DO UPDATE SET
         status = EXCLUDED.status,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         realm_id = EXCLUDED.realm_id,
         connected_at = EXCLUDED.connected_at,
         last_sync = EXCLUDED.last_sync,
         error_message = EXCLUDED.error_message,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [
        organizationId,
        row.provider,
        row.status,
        row.access_token ?? null,
        row.refresh_token ?? null,
        row.realm_id ?? null,
        row.connected_at ?? null,
        row.last_sync ?? null,
        row.error_message ?? null,
        JSON.stringify(row.metadata ?? {}),
      ]
    );
    return tenantScopedRow(organizationId, result.rows[0]);
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("gcc_integration_connections")
    .upsert(row, { onConflict: "organization_id,provider" })
    .select("*")
    .single();

  if (error || !data) return null;
  if (
    !assertOrganizationIdMatch(
      organizationId,
      (data as Record<string, unknown>).organization_id
    )
  ) {
    return null;
  }
  return data as Record<string, unknown>;
}

export async function deleteIntegrationConnection(
  organizationId: string,
  provider: string
): Promise<boolean> {
  if (!organizationId?.trim() || !provider?.trim()) return false;

  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ organization_id: string }>(
      `DELETE FROM gcc_integration_connections
       WHERE organization_id = $1 AND provider = $2
       RETURNING organization_id`,
      [organizationId, provider]
    );
    const deleted = result.rows[0];
    return Boolean(deleted && assertOrganizationIdMatch(organizationId, deleted.organization_id));
  }

  const admin = createAdminClient();
  if (!admin) return false;

  const { error } = await admin
    .from("gcc_integration_connections")
    .delete()
    .eq("organization_id", organizationId)
    .eq("provider", provider);

  return !error;
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

export function tenantScopedRow(
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
