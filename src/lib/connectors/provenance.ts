import {
  fetchProvenanceForOrg as fetchProvenanceFromPlane,
  upsertProvenanceRecord,
} from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";
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
  if (isPersistentDataBackendAvailable()) {
    await upsertProvenanceRecord(record);
    return;
  }

  memoryProvenance.push(record);
}

export async function getProvenanceForOrg(
  organizationId: string
): Promise<StoredProvenance[]> {
  const rows = await fetchProvenanceFromPlane(organizationId);
  if (rows.length > 0) return rows;

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
