import { assessKpiRisk } from "@/lib/ai/kpi-risk";
import type { KPI, KpiStatus } from "@/lib/types";

/** Suggested stoplight status from value vs target (for display hints; manual override wins). */
export function suggestKpiStatus(kpi: KPI): KpiStatus | null {
  const assessment = assessKpiRisk(kpi);
  if (assessment) return assessment.level;
  if (kpi.target != null) return "green";
  return null;
}

export function planRequiredForStatus(status: KpiStatus): boolean {
  return status === "yellow";
}

export function validateKpiPlan(status: KpiStatus | undefined, plan: string | undefined | null): string | null {
  if (status === "yellow" && !plan?.trim()) {
    return "Plan is required when status is yellow.";
  }
  return null;
}
