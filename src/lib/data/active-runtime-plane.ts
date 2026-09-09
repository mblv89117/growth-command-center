/**
 * Dual-mode helpers for ACTIVE_RUNTIME domains not yet in data-plane.ts core.
 * Routes via Azure PG when AZURE_DATABASE_URL / DATABASE_URL is set; Supabase admin otherwise.
 */
import { randomUUID } from "crypto";
import {
  assertOrganizationIdMatch,
  filterRowsByOrganizationId,
  isAzureDataPlaneActive,
  isPersistentDataBackendAvailable,
  resolveDataBackend,
  tenantScopedRow,
  type DataBackend,
} from "@/lib/data/data-plane";
import { pgQuery } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConnectorAuditEvent } from "@/lib/connectors/types";
import type { ProvenanceCategory, ProvenanceRecord } from "@/lib/connectors/types";
import type { StoredProvenance } from "@/lib/connectors/provenance";
import type { JobStatus, JobType } from "@/lib/observability/events";

export { resolveDataBackend, isAzureDataPlaneActive, isPersistentDataBackendAvailable };

export function selectImportCommitBackend(): DataBackend {
  return resolveDataBackend();
}

// --- Connector audit ---

export async function insertConnectorAuditEvent(
  event: Omit<ConnectorAuditEvent, "createdAt"> & { createdAt: string }
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_connector_audit (organization_id, connector_id, action, detail, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.organizationId, event.connectorId, event.action, event.detail ?? null, event.createdAt]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_connector_audit").insert({
      organization_id: event.organizationId,
      connector_id: event.connectorId,
      action: event.action,
      detail: event.detail,
      created_at: event.createdAt,
    });
  }
}

export async function fetchConnectorAuditLog(
  organizationId: string,
  limit = 50
): Promise<ConnectorAuditEvent[]> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      `SELECT * FROM gcc_connector_audit
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [organizationId, limit]
    );
    return filterRowsByOrganizationId(organizationId, result.rows).map(mapAuditRow);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_connector_audit")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[]).map(
    mapAuditRow
  );
}

function mapAuditRow(row: Record<string, unknown>): ConnectorAuditEvent {
  return {
    organizationId: row.organization_id as string,
    connectorId: row.connector_id as string,
    action: row.action as ConnectorAuditEvent["action"],
    detail: row.detail as string | undefined,
    createdAt: row.created_at as string,
  };
}

// --- Provenance ---

export async function upsertProvenanceRecord(record: StoredProvenance): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_data_provenance (
         organization_id, field_key, value_numeric, value_text, source, source_type,
         connector_id, file_name, period_start, period_end, category, confidence,
         synced_at, uploaded_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (organization_id, field_key, source) DO UPDATE SET
         value_numeric = EXCLUDED.value_numeric,
         value_text = EXCLUDED.value_text,
         source_type = EXCLUDED.source_type,
         connector_id = EXCLUDED.connector_id,
         file_name = EXCLUDED.file_name,
         period_start = EXCLUDED.period_start,
         period_end = EXCLUDED.period_end,
         category = EXCLUDED.category,
         confidence = EXCLUDED.confidence,
         synced_at = EXCLUDED.synced_at,
         uploaded_at = EXCLUDED.uploaded_at`,
      [
        record.organizationId,
        record.fieldKey,
        typeof record.value === "number" ? record.value : null,
        typeof record.value === "string" ? record.value : null,
        record.source,
        record.sourceType,
        record.connectorId ?? null,
        record.fileName ?? null,
        record.periodStart ?? null,
        record.periodEnd ?? null,
        record.category,
        record.confidence ?? null,
        record.syncedAt ?? null,
        record.uploadedAt ?? null,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("gcc_data_provenance").upsert(
    {
      organization_id: record.organizationId,
      field_key: record.fieldKey,
      value_numeric: typeof record.value === "number" ? record.value : null,
      value_text: typeof record.value === "string" ? record.value : null,
      source: record.source,
      source_type: record.sourceType,
      connector_id: record.connectorId,
      file_name: record.fileName,
      period_start: record.periodStart,
      period_end: record.periodEnd,
      category: record.category,
      confidence: record.confidence,
      synced_at: record.syncedAt,
      uploaded_at: record.uploadedAt,
    },
    { onConflict: "organization_id,field_key,source" }
  );
}

export async function fetchProvenanceForOrg(organizationId: string): Promise<StoredProvenance[]> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      "SELECT * FROM gcc_data_provenance WHERE organization_id = $1",
      [organizationId]
    );
    return filterRowsByOrganizationId(organizationId, result.rows).map(mapProvenanceRow);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_data_provenance")
    .select("*")
    .eq("organization_id", organizationId);

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[]).map(
    mapProvenanceRow
  );
}

function mapProvenanceRow(row: Record<string, unknown>): StoredProvenance {
  return {
    organizationId: row.organization_id as string,
    fieldKey: row.field_key as string,
    value: (row.value_numeric ?? row.value_text) as number | string,
    source: row.source as string,
    sourceType: row.source_type as ProvenanceRecord["sourceType"],
    connectorId: row.connector_id as string | undefined,
    fileName: row.file_name as string | undefined,
    periodStart: row.period_start as string | undefined,
    periodEnd: row.period_end as string | undefined,
    category: row.category as ProvenanceCategory,
    confidence: row.confidence as ProvenanceRecord["confidence"],
    syncedAt: row.synced_at as string | undefined,
    uploadedAt: row.uploaded_at as string | undefined,
  };
}

// --- Bank accounts / Plaid ---

export interface BankAccountRow {
  plaid_account_id: string;
  name: string;
  mask: string;
  balance: number;
  institution: string;
}

export async function upsertBankAccounts(
  organizationId: string,
  accounts: BankAccountRow[]
): Promise<void> {
  const lastSync = new Date().toISOString();
  if (isAzureDataPlaneActive()) {
    for (const acct of accounts) {
      await pgQuery(
        `INSERT INTO gcc_bank_accounts (
           organization_id, plaid_account_id, name, mask, balance, institution, last_sync
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (organization_id, plaid_account_id) DO UPDATE SET
           name = EXCLUDED.name,
           mask = EXCLUDED.mask,
           balance = EXCLUDED.balance,
           institution = EXCLUDED.institution,
           last_sync = EXCLUDED.last_sync`,
        [
          organizationId,
          acct.plaid_account_id,
          acct.name,
          acct.mask,
          acct.balance,
          acct.institution,
          lastSync,
        ]
      );
    }
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  for (const acct of accounts) {
    await admin.from("gcc_bank_accounts").upsert(
      { organization_id: organizationId, ...acct, last_sync: lastSync },
      { onConflict: "organization_id,plaid_account_id" }
    );
  }
}

export async function deleteBankAccountsByOrganizationId(organizationId: string): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery("DELETE FROM gcc_bank_accounts WHERE organization_id = $1", [organizationId]);
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_bank_accounts").delete().eq("organization_id", organizationId);
  }
}

export async function updateFinancialSnapshotCash(
  organizationId: string,
  currentCash: number
): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `UPDATE gcc_financial_snapshots SET current_cash = $2, updated_at = $3
       WHERE organization_id = $1`,
      [organizationId, currentCash, updatedAt]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_financial_snapshots")
      .update({ current_cash: currentCash, updated_at: updatedAt })
      .eq("organization_id", organizationId);
  }
}

// --- Job runs ---

export async function insertJobRun(
  organizationId: string,
  jobType: JobType,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ id: string; organization_id: string }>(
      `INSERT INTO gcc_job_runs (organization_id, job_type, status, metadata)
       VALUES ($1, $2, 'running', $3)
       RETURNING id, organization_id`,
      [organizationId, jobType, JSON.stringify(metadata ?? {})]
    );
    const row = result.rows[0];
    if (!row || !assertOrganizationIdMatch(organizationId, row.organization_id)) return null;
    return row.id;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("gcc_job_runs")
    .insert({
      organization_id: organizationId,
      job_type: jobType,
      status: "running",
      metadata: metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data?.id) return null;
  return data.id as string;
}

export async function updateJobRun(
  jobId: string,
  status: JobStatus,
  errorMessage?: string
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `UPDATE gcc_job_runs SET status = $2, error_message = $3, completed_at = $4
       WHERE id = $1`,
      [jobId, status, errorMessage ?? null, new Date().toISOString()]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_job_runs")
      .update({
        status,
        error_message: errorMessage ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

export async function countRecentFailedJobRuns(sinceIso: string): Promise<number> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM gcc_job_runs
       WHERE status = 'failed' AND started_at >= $1`,
      [sinceIso]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  const admin = createAdminClient();
  if (!admin) return 0;

  const { count } = await admin
    .from("gcc_job_runs")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("started_at", sinceIso);

  return count ?? 0;
}

// --- Profiles / tenant provisioning ---

export async function fetchProfileByUserId(
  userId: string
): Promise<{ organization_id: string | null; role: string | null; email: string | null } | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{
      organization_id: string | null;
      role: string | null;
      email: string | null;
    }>(
      `SELECT organization_id, role, email FROM gcc_profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_profiles")
    .select("organization_id, role, email")
    .eq("id", userId)
    .maybeSingle();

  return data ?? null;
}

export async function fetchProfileByEmail(
  email: string
): Promise<{ id: string; organization_id: string | null; role: string | null } | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{
      id: string;
      organization_id: string | null;
      role: string | null;
    }>(
      `SELECT id, organization_id, role FROM gcc_profiles WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    return result.rows[0] ?? null;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_profiles")
    .select("id, organization_id, role")
    .ilike("email", email)
    .maybeSingle();

  return data ?? null;
}

export async function organizationExistsById(organizationId: string): Promise<boolean> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ id: string }>(
      "SELECT id FROM gcc_organizations WHERE id = $1 LIMIT 1",
      [organizationId]
    );
    const row = result.rows[0];
    return Boolean(row && assertOrganizationIdMatch(organizationId, row.id));
  }

  const admin = createAdminClient();
  if (!admin) return false;

  const { data } = await admin
    .from("gcc_organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  return Boolean(data);
}

export async function checkOrganizationSlugTaken(orgId: string): Promise<boolean> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ id: string }>(
      "SELECT id FROM gcc_organizations WHERE id = $1 LIMIT 1",
      [orgId]
    );
    return Boolean(result.rows[0]);
  }

  const admin = createAdminClient();
  if (!admin) return false;

  const { data } = await admin.from("gcc_organizations").select("id").eq("id", orgId).maybeSingle();
  return Boolean(data);
}

export async function insertOrganizationRow(row: Record<string, unknown>): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_organizations (
         id, name, slug, industry, plan, subscription_status, data_source, trial_ends_at,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.name,
        row.slug,
        row.industry ?? null,
        row.plan ?? "starter",
        row.subscription_status ?? "trial",
        row.data_source ?? "empty",
        row.trial_ends_at ?? null,
        row.utm_source ?? null,
        row.utm_medium ?? null,
        row.utm_campaign ?? null,
        row.utm_content ?? null,
        row.utm_term ?? null,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("gcc_organizations").insert(row);
}

export async function upsertEmptyFinancialSnapshot(organizationId: string): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_financial_snapshots (organization_id) VALUES ($1)
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_financial_snapshots")
      .upsert({ organization_id: organizationId }, { onConflict: "organization_id" });
  }
}

export async function linkProfileToOrganization(
  userId: string,
  organizationId: string,
  role: string,
  email?: string
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_profiles (id, organization_id, role, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         role = EXCLUDED.role,
         email = COALESCE(EXCLUDED.email, gcc_profiles.email)`,
      [userId, organizationId, role, email ?? null]
    );
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  const { data: existing } = await admin
    .from("gcc_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("gcc_profiles")
      .update({ organization_id: organizationId, role })
      .eq("id", userId);
  } else if (email) {
    await admin.from("gcc_profiles").insert({
      id: userId,
      organization_id: organizationId,
      role,
      email,
    });
  } else {
    await admin
      .from("gcc_profiles")
      .update({ organization_id: organizationId, role })
      .eq("id", userId);
  }
}

export function generateProviderNeutralUserId(): string {
  return randomUUID();
}

// --- Billing ---

export async function fetchOrganizationBillingFields(
  organizationId: string
): Promise<{ stripe_customer_id: string | null; name: string | null } | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ stripe_customer_id: string | null; name: string | null; id: string }>(
      "SELECT id, stripe_customer_id, name FROM gcc_organizations WHERE id = $1 LIMIT 1",
      [organizationId]
    );
    const row = result.rows[0];
    if (!row || !assertOrganizationIdMatch(organizationId, row.id)) return null;
    return { stripe_customer_id: row.stripe_customer_id, name: row.name };
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_organizations")
    .select("stripe_customer_id, name")
    .eq("id", organizationId)
    .maybeSingle();

  return data ?? null;
}

export async function updateOrganizationBilling(
  organizationId: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    const keys = Object.keys(patch);
    if (keys.length === 0) return;
    const setClauses = keys.map((key, index) => `${key} = $${index + 2}`);
    const values = keys.map((key) => patch[key]);
    await pgQuery(
      `UPDATE gcc_organizations SET ${setClauses.join(", ")} WHERE id = $1`,
      [organizationId, ...values]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_organizations").update(patch).eq("id", organizationId);
  }
}

export async function upsertSubscriptionRow(row: Record<string, unknown>): Promise<void> {
  const organizationId = row.organization_id as string;
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_subscriptions (
         organization_id, stripe_customer_id, stripe_subscription_id, plan, status
       ) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id) DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         plan = EXCLUDED.plan,
         status = EXCLUDED.status`,
      [
        organizationId,
        row.stripe_customer_id,
        row.stripe_subscription_id,
        row.plan,
        row.status,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_subscriptions").upsert(row, { onConflict: "organization_id" });
  }
}

export async function updateSubscriptionStatus(
  organizationId: string,
  status: string
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      "UPDATE gcc_subscriptions SET status = $2 WHERE organization_id = $1",
      [organizationId, status]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_subscriptions").update({ status }).eq("organization_id", organizationId);
  }
}

export async function fetchSubscriptionByStripeCustomer(
  stripeCustomerId: string
): Promise<{ organization_id: string } | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ organization_id: string }>(
      "SELECT organization_id FROM gcc_subscriptions WHERE stripe_customer_id = $1 LIMIT 1",
      [stripeCustomerId]
    );
    return result.rows[0] ?? null;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  return data ?? null;
}

// --- AI advisor persistence ---

export async function fetchOrganizationNameById(organizationId: string): Promise<string | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ name: string | null; id: string }>(
      "SELECT id, name FROM gcc_organizations WHERE id = $1 LIMIT 1",
      [organizationId]
    );
    const row = result.rows[0];
    if (!row || !assertOrganizationIdMatch(organizationId, row.id)) return null;
    return row.name;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  return (data?.name as string | undefined) ?? null;
}

export async function fetchAiConversationMessages(
  conversationId: string,
  organizationId: string,
  limit = 10
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ role: string; content: string; organization_id: string }>(
      `SELECT role, content, organization_id FROM gcc_ai_messages
       WHERE conversation_id = $1 AND organization_id = $2
       ORDER BY created_at ASC
       LIMIT $3`,
      [conversationId, organizationId, limit]
    );
    return filterRowsByOrganizationId(organizationId, result.rows).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_ai_messages")
    .select("role, content, organization_id")
    .eq("conversation_id", conversationId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[]).map(
    (m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    })
  );
}

export async function createAiConversation(
  organizationId: string,
  userId: string,
  title: string
): Promise<string | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ id: string; organization_id: string }>(
      `INSERT INTO gcc_ai_conversations (organization_id, user_id, title)
       VALUES ($1, $2, $3)
       RETURNING id, organization_id`,
      [organizationId, userId, title]
    );
    const row = result.rows[0];
    if (!row || !assertOrganizationIdMatch(organizationId, row.organization_id)) return null;
    return row.id;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_ai_conversations")
    .insert({ organization_id: organizationId, user_id: userId, title })
    .select("id")
    .single();

  return (data?.id as string | undefined) ?? null;
}

export async function insertAiMessages(
  conversationId: string,
  organizationId: string,
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    data_sources?: string[];
  }>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    for (const msg of messages) {
      await pgQuery(
        `INSERT INTO gcc_ai_messages (conversation_id, organization_id, role, content, data_sources)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          conversationId,
          organizationId,
          msg.role,
          msg.content,
          JSON.stringify(msg.data_sources ?? []),
        ]
      );
    }
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("gcc_ai_messages").insert(
    messages.map((msg) => ({
      conversation_id: conversationId,
      organization_id: organizationId,
      role: msg.role,
      content: msg.content,
      data_sources: msg.data_sources ?? [],
    }))
  );
}

// --- Import commit + pipeline recompute (shared reads/writes) ---

export async function fetchFinancialSnapshotRow(
  organizationId: string
): Promise<Record<string, unknown> | null> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      "SELECT * FROM gcc_financial_snapshots WHERE organization_id = $1 LIMIT 1",
      [organizationId]
    );
    return tenantScopedRow(organizationId, result.rows[0]);
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("gcc_financial_snapshots")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) return null;
  return tenantScopedRow(organizationId, data as Record<string, unknown>);
}

export async function fetchMonthlyTrendRows(
  organizationId: string
): Promise<Record<string, unknown>[]> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<Record<string, unknown>>(
      "SELECT * FROM gcc_monthly_trends WHERE organization_id = $1 ORDER BY sort_order",
      [organizationId]
    );
    return filterRowsByOrganizationId(organizationId, result.rows);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_monthly_trends")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order");

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[]);
}

export async function fetchOrganizationSettingsJson(
  organizationId: string
): Promise<Record<string, unknown>> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ settings: Record<string, unknown> | null; id: string }>(
      "SELECT id, settings FROM gcc_organizations WHERE id = $1 LIMIT 1",
      [organizationId]
    );
    const row = result.rows[0];
    if (!row || !assertOrganizationIdMatch(organizationId, row.id)) return {};
    return (row.settings as Record<string, unknown> | null) ?? {};
  }

  const admin = createAdminClient();
  if (!admin) return {};

  const { data } = await admin
    .from("gcc_organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  return ((data?.settings as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
}

export async function upsertFinancialSnapshotImport(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_financial_snapshots (
         organization_id, current_cash, revenue_mtd, revenue_ytd, gross_profit, net_profit,
         operating_expenses, accounts_receivable, accounts_payable, payroll_obligations, ebitda, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (organization_id) DO UPDATE SET
         current_cash = EXCLUDED.current_cash,
         revenue_mtd = EXCLUDED.revenue_mtd,
         revenue_ytd = EXCLUDED.revenue_ytd,
         gross_profit = EXCLUDED.gross_profit,
         net_profit = EXCLUDED.net_profit,
         operating_expenses = EXCLUDED.operating_expenses,
         accounts_receivable = EXCLUDED.accounts_receivable,
         accounts_payable = EXCLUDED.accounts_payable,
         payroll_obligations = EXCLUDED.payroll_obligations,
         ebitda = EXCLUDED.ebitda,
         updated_at = EXCLUDED.updated_at`,
      [
        organizationId,
        row.current_cash,
        row.revenue_mtd,
        row.revenue_ytd,
        row.gross_profit,
        row.net_profit,
        row.operating_expenses,
        row.accounts_receivable,
        row.accounts_payable,
        row.payroll_obligations,
        row.ebitda,
        row.updated_at,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_financial_snapshots")
      .upsert({ organization_id: organizationId, ...row }, { onConflict: "organization_id" });
  }
}

export async function upsertMonthlyTrendRow(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_monthly_trends (
         organization_id, month, revenue, expenses, profit, cash, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id, month) DO UPDATE SET
         revenue = EXCLUDED.revenue,
         expenses = EXCLUDED.expenses,
         profit = EXCLUDED.profit,
         cash = EXCLUDED.cash,
         sort_order = EXCLUDED.sort_order`,
      [
        organizationId,
        row.month,
        row.revenue,
        row.expenses,
        row.profit,
        row.cash,
        row.sort_order,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_monthly_trends")
      .upsert({ organization_id: organizationId, ...row }, { onConflict: "organization_id,month" });
  }
}

export async function upsertTransactionRow(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_transactions (
         organization_id, txn_key, txn_date, description, category, amount, txn_type
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id, txn_key) DO UPDATE SET
         txn_date = EXCLUDED.txn_date,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         amount = EXCLUDED.amount,
         txn_type = EXCLUDED.txn_type`,
      [
        organizationId,
        row.txn_key,
        row.txn_date,
        row.description,
        row.category,
        row.amount,
        row.txn_type,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_transactions")
      .upsert({ organization_id: organizationId, ...row }, { onConflict: "organization_id,txn_key" });
  }
}

export async function insertImportJobRow(row: Record<string, unknown>): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_import_jobs (
         organization_id, template_type, file_name, status, row_count, error_count,
         mapping, source_provenance, created_by, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        row.organization_id,
        row.template_type,
        row.file_name,
        row.status,
        row.row_count,
        row.error_count,
        JSON.stringify(row.mapping ?? {}),
        row.source_provenance,
        row.created_by ?? null,
        row.completed_at,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_import_jobs").insert(row);
  }
}

export async function updateOrganizationDataSource(
  organizationId: string,
  dataSource: string
): Promise<void> {
  await updateOrganizationBilling(organizationId, { data_source: dataSource });
}

export async function updateFinancialSnapshotComputed(
  organizationId: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    const keys = Object.keys(patch);
    const setClauses = keys.map((key, index) => `${key} = $${index + 2}`);
    const values = keys.map((key) => patch[key]);
    await pgQuery(
      `UPDATE gcc_financial_snapshots SET ${setClauses.join(", ")} WHERE organization_id = $1`,
      [organizationId, ...values]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_financial_snapshots").update(patch).eq("organization_id", organizationId);
  }
}

export async function upsertCashForecastWeekRow(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_cash_forecast_weeks (
         organization_id, week_num, week_start, week_end, starting_balance,
         inflows, outflows, ending_balance, is_risk_period
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (organization_id, week_num) DO UPDATE SET
         week_start = EXCLUDED.week_start,
         week_end = EXCLUDED.week_end,
         starting_balance = EXCLUDED.starting_balance,
         inflows = EXCLUDED.inflows,
         outflows = EXCLUDED.outflows,
         ending_balance = EXCLUDED.ending_balance,
         is_risk_period = EXCLUDED.is_risk_period`,
      [
        organizationId,
        row.week_num,
        row.week_start,
        row.week_end,
        row.starting_balance,
        row.inflows,
        row.outflows,
        row.ending_balance,
        row.is_risk_period,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_cash_forecast_weeks")
      .upsert({ organization_id: organizationId, ...row }, { onConflict: "organization_id,week_num" });
  }
}

export async function upsertCashForecastMonthRow(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_cash_forecast_months (
         organization_id, month_label, inflows, outflows, ending_balance, is_risk_period
       ) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (organization_id, month_label) DO UPDATE SET
         inflows = EXCLUDED.inflows,
         outflows = EXCLUDED.outflows,
         ending_balance = EXCLUDED.ending_balance,
         is_risk_period = EXCLUDED.is_risk_period`,
      [
        organizationId,
        row.month_label,
        row.inflows,
        row.outflows,
        row.ending_balance,
        row.is_risk_period,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_cash_forecast_months")
      .upsert({ organization_id: organizationId, ...row }, { onConflict: "organization_id,month_label" });
  }
}

export async function fetchKpiOverrideRows(
  organizationId: string
): Promise<Array<{ kpi_key: string; manual_override: boolean | null; target: unknown; enabled: boolean | null }>> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{
      kpi_key: string;
      manual_override: boolean | null;
      target: unknown;
      enabled: boolean | null;
      organization_id: string;
    }>(
      `SELECT kpi_key, manual_override, target, enabled, organization_id
       FROM gcc_kpis WHERE organization_id = $1`,
      [organizationId]
    );
    return filterRowsByOrganizationId(organizationId, result.rows);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_kpis")
    .select("kpi_key, manual_override, target, enabled, organization_id")
    .eq("organization_id", organizationId);

  return filterRowsByOrganizationId(organizationId, (data ?? []) as Record<string, unknown>[]) as Array<{
    kpi_key: string;
    manual_override: boolean | null;
    target: unknown;
    enabled: boolean | null;
  }>;
}

export async function upsertKpiComputedRow(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_kpis (
         organization_id, kpi_key, name, value, unit, change, change_label,
         target, status, enabled, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (organization_id, kpi_key) DO UPDATE SET
         name = EXCLUDED.name,
         value = EXCLUDED.value,
         unit = EXCLUDED.unit,
         change = EXCLUDED.change,
         change_label = EXCLUDED.change_label,
         target = EXCLUDED.target,
         status = EXCLUDED.status,
         enabled = EXCLUDED.enabled,
         updated_at = EXCLUDED.updated_at`,
      [
        organizationId,
        row.kpi_key,
        row.name,
        row.value,
        row.unit,
        row.change,
        row.change_label ?? null,
        row.target ?? null,
        row.status ?? null,
        row.enabled ?? true,
        row.updated_at,
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("gcc_kpis")
      .upsert({ organization_id: organizationId, ...row }, { onConflict: "organization_id,kpi_key" });
  }
}

export async function countForecastVersions(organizationId: string): Promise<number> {
  if (isAzureDataPlaneActive()) {
    const result = await pgQuery<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM gcc_forecast_versions WHERE organization_id = $1",
      [organizationId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  const admin = createAdminClient();
  if (!admin) return 0;

  const { count } = await admin
    .from("gcc_forecast_versions")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return count ?? 0;
}

export async function insertForecastVersionRow(
  organizationId: string,
  row: Record<string, unknown>
): Promise<void> {
  if (isAzureDataPlaneActive()) {
    await pgQuery(
      `INSERT INTO gcc_forecast_versions (
         organization_id, version_num, ending_cash, minimum_cash, assumptions_snapshot
       ) VALUES ($1,$2,$3,$4,$5)`,
      [
        organizationId,
        row.version_num,
        row.ending_cash,
        row.minimum_cash,
        JSON.stringify(row.assumptions_snapshot ?? {}),
      ]
    );
    return;
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_forecast_versions").insert({ organization_id: organizationId, ...row });
  }
}
