import type { FinancialSnapshot, MonthlyTrend } from "@/lib/types";

export interface MetricDelta {
  value: number;
  change: number;
  changeLabel: string;
  direction: "up" | "down" | "flat";
}

export interface DashboardDeltas {
  currentCash: MetricDelta;
  forecastedCash: MetricDelta;
  revenueMTD: MetricDelta;
  revenueYTD: MetricDelta;
  grossProfit: MetricDelta;
  netProfit: MetricDelta;
  operatingExpenses: MetricDelta;
  accountsReceivable: MetricDelta;
  accountsPayable: MetricDelta;
  runway: MetricDelta;
  workingCapital: MetricDelta;
  ebitda: MetricDelta;
}

function pctChange(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
}

function buildDelta(current: number, prior: number | null, label: string): MetricDelta {
  if (prior === null) {
    return { value: current, change: 0, changeLabel: label, direction: "flat" };
  }
  const change = pctChange(current, prior);
  return {
    value: current,
    change,
    changeLabel: label,
    direction: change > 0.5 ? "up" : change < -0.5 ? "down" : "flat",
  };
}

export function computeDashboardDeltas(
  snapshot: FinancialSnapshot,
  trends: MonthlyTrend[]
): DashboardDeltas {
  const priorMonth = trends.length >= 2 ? trends[trends.length - 2] : null;
  const workingCapital = computeWorkingCapital(snapshot);
  const priorWorkingCapital =
    priorMonth != null
      ? priorMonth.cash + snapshot.accountsReceivable - snapshot.accountsPayable
      : null;

  return {
    currentCash: buildDelta(snapshot.currentCash, priorMonth?.cash ?? null, "vs prior month"),
    forecastedCash: buildDelta(snapshot.forecastedCash, snapshot.currentCash, "vs current cash"),
    revenueMTD: buildDelta(snapshot.revenueMTD, priorMonth?.revenue ?? null, "vs prior month"),
    revenueYTD: buildDelta(snapshot.revenueYTD, snapshot.revenueYTD - snapshot.revenueMTD, "vs prior YTD"),
    grossProfit: buildDelta(snapshot.grossProfit, priorMonth?.profit ?? null, "vs prior month"),
    netProfit: buildDelta(snapshot.netProfit, priorMonth?.profit ?? null, "vs prior month"),
    operatingExpenses: buildDelta(
      snapshot.operatingExpenses,
      priorMonth?.expenses ?? null,
      "vs prior month"
    ),
    accountsReceivable: buildDelta(snapshot.accountsReceivable, null, "vs prior month"),
    accountsPayable: buildDelta(snapshot.accountsPayable, null, "vs prior month"),
    runway: buildDelta(snapshot.runway, null, "vs prior month"),
    workingCapital: buildDelta(workingCapital, priorWorkingCapital, "vs prior month"),
    ebitda: buildDelta(snapshot.ebitda, null, "vs prior month"),
  };
}

export function computeWorkingCapital(snapshot: FinancialSnapshot): number {
  return snapshot.currentCash + snapshot.accountsReceivable - snapshot.accountsPayable;
}

export function computeForecastVariance(
  forecastedCash: number,
  priorForecastedCash: number
): { variance: number; variancePercent: number; label: string } {
  const variance = forecastedCash - priorForecastedCash;
  const variancePercent =
    priorForecastedCash === 0 ? 0 : Math.round((variance / Math.abs(priorForecastedCash)) * 1000) / 10;
  return {
    variance,
    variancePercent,
    label: variance >= 0 ? "above prior forecast" : "below prior forecast",
  };
}
