import type { CanonicalFinancialSnapshot } from "./types";

/**
 * Default source priority for overlapping financial periods (highest authority first).
 * Live accounting ledger > bank balances > payments > uploaded structured files > PDF extraction.
 */
export const DEFAULT_SOURCE_PRIORITY = [
  "QuickBooks Online",
  "Xero",
  "Plaid",
  "Stripe",
  "Google Sheets",
  "CSV/XLSX Upload",
  "PDF Upload (confirmed)",
] as const;

export interface DedupeRule {
  field: string;
  periodKey: string;
  winnerSource: string;
  suppressedSources: string[];
}

/** Detect potential double-counting when multiple sources supply the same period + field */
export function detectDuplicateSources(
  snapshots: CanonicalFinancialSnapshot[]
): DedupeRule[] {
  const conflicts: DedupeRule[] = [];
  const byPeriod = new Map<string, CanonicalFinancialSnapshot[]>();

  for (const snap of snapshots) {
    const period = snap.periodEnd ?? snap.periodStart ?? "current";
    const list = byPeriod.get(period) ?? [];
    list.push(snap);
    byPeriod.set(period, list);
  }

  for (const [period, group] of byPeriod) {
    if (group.length < 2) continue;
    const sources = group.map((s) => s.provenance.source);
    const unique = [...new Set(sources)];
    if (unique.length < 2) continue;

    const winner = resolveSourceWinner(unique);
    conflicts.push({
      field: "financial_snapshot",
      periodKey: period,
      winnerSource: winner,
      suppressedSources: unique.filter((s) => s !== winner),
    });
  }

  return conflicts;
}

export function resolveSourceWinner(sources: string[]): string {
  for (const priority of DEFAULT_SOURCE_PRIORITY) {
    const match = sources.find((s) => s.toLowerCase().includes(priority.toLowerCase().split(" ")[0]!));
    if (match) return match;
  }
  return sources[0] ?? "unknown";
}
