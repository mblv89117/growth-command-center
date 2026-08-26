import type { FinancialSnapshot } from "@/lib/types";
import type { CanonicalFinancialSnapshot, ProvenanceRecord } from "./types";

/** Canonical GCC financial field keys — single model for all ingestion paths */
export const CANONICAL_FINANCIAL_FIELDS = [
  "revenue",
  "cogs",
  "grossProfit",
  "payroll",
  "operatingExpenses",
  "ebitda",
  "netIncome",
  "currentCash",
  "accountsReceivable",
  "accountsPayable",
  "debt",
  "workingCapital",
] as const;

export type CanonicalFinancialField = (typeof CANONICAL_FINANCIAL_FIELDS)[number];

/** Map canonical snapshot → existing dashboard FinancialSnapshot shape */
export function canonicalToFinancialSnapshot(
  canonical: CanonicalFinancialSnapshot
): Partial<FinancialSnapshot> {
  return {
    currentCash: canonical.currentCash ?? 0,
    revenueMTD: canonical.revenue ?? 0,
    revenueYTD: canonical.revenue ?? 0,
    grossProfit: canonical.grossProfit ?? 0,
    netProfit: canonical.netIncome ?? 0,
    operatingExpenses: canonical.operatingExpenses ?? 0,
    accountsReceivable: canonical.accountsReceivable ?? 0,
    accountsPayable: canonical.accountsPayable ?? 0,
    ebitda: canonical.ebitda ?? 0,
    payrollObligations: canonical.payroll ?? 0,
    debtObligations: canonical.debt ?? 0,
  };
}

export function buildProvenance(
  partial: Omit<ProvenanceRecord, "category"> & { category?: ProvenanceRecord["category"] }
): ProvenanceRecord {
  return {
    category: partial.category ?? "SOURCE_VERIFIED",
    source: partial.source,
    sourceType: partial.sourceType,
    connectorId: partial.connectorId,
    fileName: partial.fileName,
    period: partial.period,
    syncedAt: partial.syncedAt,
    uploadedAt: partial.uploadedAt,
    confidence: partial.confidence,
  };
}

/** Merge multiple canonical snapshots using source priority (higher index wins for overlapping periods) */
export function mergeCanonicalSnapshots(
  snapshots: CanonicalFinancialSnapshot[],
  sourcePriority: string[]
): CanonicalFinancialSnapshot | null {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => {
    const aIdx = sourcePriority.indexOf(a.provenance.source);
    const bIdx = sourcePriority.indexOf(b.provenance.source);
    return (bIdx === -1 ? 0 : bIdx) - (aIdx === -1 ? 0 : aIdx);
  });

  const base = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    for (const field of CANONICAL_FINANCIAL_FIELDS) {
      const key = field as keyof CanonicalFinancialSnapshot;
      if (next[key] !== undefined && next[key] !== null) {
        (base as Record<string, unknown>)[key] = next[key];
      }
    }
  }
  return base;
}
