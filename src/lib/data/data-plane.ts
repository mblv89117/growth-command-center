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
