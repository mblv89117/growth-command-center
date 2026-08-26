import type { SnapshotFieldProvenance } from "@/lib/imports/honesty";
import { isEmptyFinancialSnapshot } from "@/lib/imports/honesty";
import type { Alert, FinancialSnapshot, KPI } from "@/lib/types";

export type KpiRiskLevel = "red" | "yellow" | "green";

export interface KpiRiskAssessment {
  kpi: KPI;
  level: KpiRiskLevel;
  reason: string;
}

const LOWER_IS_BETTER = new Set([
  "cash conversion cycle",
  "ar days",
  "ap days",
  "operating expense ratio",
  "burn rate",
]);

function isLowerBetter(name: string): boolean {
  const normalized = name.toLowerCase();
  return [...LOWER_IS_BETTER].some((pattern) => normalized.includes(pattern));
}

export function assessKpiRisk(kpi: KPI): KpiRiskAssessment | null {
  if (kpi.target == null) return null;

  const lowerBetter = isLowerBetter(kpi.name);
  const delta = kpi.value - kpi.target;
  const tolerance = Math.abs(kpi.target) * 0.05 || 1;

  if (lowerBetter) {
    if (delta > tolerance * 2) {
      return {
        kpi,
        level: "red",
        reason: `${kpi.name} is above target (${kpi.value} vs ${kpi.target})`,
      };
    }
    if (delta > 0) {
      return {
        kpi,
        level: "yellow",
        reason: `${kpi.name} is slightly above target (${kpi.value} vs ${kpi.target})`,
      };
    }
    return { kpi, level: "green", reason: `${kpi.name} is within target` };
  }

  if (delta < -tolerance * 2) {
    return {
      kpi,
      level: "red",
      reason: `${kpi.name} is well below target (${kpi.value} vs ${kpi.target})`,
    };
  }
  if (delta < 0) {
    return {
      kpi,
      level: "yellow",
      reason: `${kpi.name} is below target (${kpi.value} vs ${kpi.target})`,
    };
  }
  return { kpi, level: "green", reason: `${kpi.name} is on or above target` };
}

export function getAtRiskKpis(kpis: KPI[]): KpiRiskAssessment[] {
  return kpis
    .map(assessKpiRisk)
    .filter((item): item is KpiRiskAssessment => item !== null && item.level !== "green");
}

export function getFinancialRiskSignals(
  snapshot: FinancialSnapshot,
  _provenance?: SnapshotFieldProvenance
): string[] {
  if (isEmptyFinancialSnapshot(snapshot)) return [];

  const signals: string[] = [];

  // Do not invent runway<6, forecastedCash<currentCash*0.85, burn>revenue*0.9,
  // netProfit/grossProfit<0.25, or AR>revenueMTD*1.5.
  // Sign-based netProfit<0 is SOURCE-DERIVED. Owner KPI targets use assessKpiRisk.

  if (snapshot.netProfit < 0) {
    signals.push("Net profit is negative — margin risk");
  }

  return signals;
}

export function getPriorityAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(
    (alert) => !alert.isRead && (alert.severity === "critical" || alert.severity === "high")
  );
}
