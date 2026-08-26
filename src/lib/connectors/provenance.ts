import { createAdminClient } from "@/lib/supabase/admin";
import type { ProvenanceCategory, ProvenanceRecord } from "./types";

export interface StoredProvenance extends ProvenanceRecord {
  organizationId: string;
  fieldKey: string;
  value: number | string;
  periodStart?: string;
  periodEnd?: string;
}

const memoryProvenance: StoredProvenance[] = [];

export async function storeProvenance(record: StoredProvenance): Promise<void> {
  const admin = createAdminClient();
  if (admin) {
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
  } else {
    memoryProvenance.push(record);
  }
}

export async function getProvenanceForOrg(
  organizationId: string
): Promise<StoredProvenance[]> {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("gcc_data_provenance")
      .select("*")
      .eq("organization_id", organizationId);

    return (data ?? []).map((row) => ({
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
    }));
  }

  return memoryProvenance.filter((p) => p.organizationId === organizationId);
}

/** Returns true if provenance category is safe for AI CFO / dashboard as verified truth */
export function isVerifiedProvenance(category: ProvenanceCategory): boolean {
  return (
    category === "SOURCE_VERIFIED" ||
    category === "USER_CONFIRMED" ||
    category === "DETERMINISTICALLY_DERIVED"
  );
}

export function formatProvenanceForDisplay(record: ProvenanceRecord): string {
  const parts = [`Source: ${record.source}`];
  if (record.period) parts.push(`Period: ${record.period}`);
  if (record.syncedAt) parts.push(`Synced: ${new Date(record.syncedAt).toLocaleDateString()}`);
  if (record.uploadedAt) parts.push(`Uploaded: ${new Date(record.uploadedAt).toLocaleDateString()}`);
  if (record.category === "AI_EXTRACTED_PENDING_CONFIRMATION") {
    parts.push("(pending confirmation)");
  }
  return parts.join(" · ");
}
