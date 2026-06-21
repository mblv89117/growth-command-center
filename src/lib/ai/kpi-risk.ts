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

export function getFinancialRiskSignals(snapshot: FinancialSnapshot): string[] {
  const signals: string[] = [];

  if (snapshot.runway < 6) {
    signals.push(`Runway is ${snapshot.runway.toFixed(1)} months — cash risk elevated`);
  }
  if (snapshot.forecastedCash < snapshot.currentCash * 0.85) {
    signals.push("13-week forecast shows meaningful cash decline");
  }
  if (snapshot.netProfit < 0) {
    signals.push("Net profit is negative — margin risk");
  } else if (snapshot.grossProfit > 0 && snapshot.netProfit / snapshot.grossProfit < 0.25) {
    signals.push("Net margin is thin relative to gross profit");
  }
  if (snapshot.accountsReceivable > snapshot.revenueMTD * 1.5) {
    signals.push("Accounts receivable is elevated vs monthly revenue");
  }
  if (snapshot.burnRate > snapshot.revenueMTD * 0.9) {
    signals.push("Burn rate is high relative to revenue MTD");
  }

  return signals;
}

export function getPriorityAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(
    (alert) => !alert.isRead && (alert.severity === "critical" || alert.severity === "high")
  );
}
