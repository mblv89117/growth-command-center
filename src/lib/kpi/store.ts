import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateKpiNumericValue } from "@/lib/kpi/limits";
import type { KPI, KpiStatus } from "@/lib/types";

export interface KpiUpdateInput {
  name?: string;
  value?: number;
  target?: number | null;
  status?: KpiStatus;
  plan?: string | null;
}

const memoryKpis = new Map<string, KPI>();

function memoryKey(organizationId: string, kpiKey: string): string {
  return `${organizationId}:${kpiKey}`;
}

function mapRow(row: Record<string, unknown>): KPI {
  return {
    id: row.kpi_key as string,
    name: row.name as string,
    value: Number(row.value),
    unit: row.unit as KPI["unit"],
    change: Number(row.change),
    changeLabel: (row.change_label as string | null) ?? "",
    target: row.target != null ? Number(row.target) : undefined,
    status: (row.status as KpiStatus | null) ?? undefined,
    plan: (row.plan as string | null) ?? undefined,
    updatedAt: (row.updated_at as string | null) ?? undefined,
    manualOverride: row.manual_override != null ? Boolean(row.manual_override) : undefined,
  };
}

function applyPatch(kpi: KPI, patch: KpiUpdateInput): KPI {
  return {
    ...kpi,
    name: patch.name ?? kpi.name,
    value: patch.value ?? kpi.value,
    target: patch.target !== undefined ? (patch.target ?? undefined) : kpi.target,
    status: patch.status ?? kpi.status,
    plan: patch.plan !== undefined ? (patch.plan ?? undefined) : kpi.plan,
    updatedAt: new Date().toISOString(),
    manualOverride: true,
  };
}

function validatePatchForUnit(unit: KPI["unit"], patch: KpiUpdateInput): void {
  if (patch.value !== undefined) {
    const error = validateKpiNumericValue(unit, patch.value, "Value");
    if (error) throw new ValidationError(error);
  }
  if (patch.target !== undefined && patch.target != null) {
    const error = validateKpiNumericValue(unit, patch.target, "Target");
    if (error) throw new ValidationError(error);
  }
}

export async function updateKpi(
  organizationId: string,
  kpiKey: string,
  patch: KpiUpdateInput,
  options: { demoMode?: boolean } = {}
): Promise<KPI> {
  const key = memoryKey(organizationId, kpiKey);
  const admin = createAdminClient();

  if (options.demoMode) {
    const existing =
      memoryKpis.get(key) ??
      ({
        id: kpiKey,
        name: patch.name ?? kpiKey.replace(/_/g, " "),
        value: patch.value ?? 0,
        unit: "number",
        change: 0,
        changeLabel: "",
        target: patch.target ?? undefined,
        status: patch.status ?? "green",
        plan: patch.plan ?? undefined,
        manualOverride: true,
      } satisfies KPI);

    validatePatchForUnit(existing.unit, patch);

    const updated = applyPatch(existing, patch);
    memoryKpis.set(key, updated);
    return updated;
  }

  if (!admin) {
    throw new Error("Database admin client is not configured.");
  }

  const { data: existing, error: fetchError } = await admin
    .from("gcc_kpis")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("kpi_key", kpiKey)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new NotFoundError("KPI not found");

  validatePatchForUnit(mapRow(existing).unit, patch);

  const rowPatch: Record<string, unknown> = {
    manual_override: true,
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) rowPatch.name = patch.name;
  if (patch.value !== undefined) rowPatch.value = patch.value;
  if (patch.target !== undefined) rowPatch.target = patch.target;
  if (patch.status !== undefined) rowPatch.status = patch.status;
  if (patch.plan !== undefined) rowPatch.plan = patch.plan;

  const { data, error } = await admin
    .from("gcc_kpis")
    .update(rowPatch)
    .eq("organization_id", organizationId)
    .eq("kpi_key", kpiKey)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}
