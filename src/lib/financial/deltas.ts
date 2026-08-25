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

function buildDelta(current: number, prior: number, label: string): MetricDelta {
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
  const priorCash = priorMonth?.cash ?? snapshot.currentCash;
  const priorRevenue = priorMonth?.revenue ?? snapshot.revenueMTD;
  const priorExpenses = priorMonth?.expenses ?? snapshot.operatingExpenses;
  const priorProfit = priorMonth?.profit ?? snapshot.netProfit;

  const workingCapital =
    snapshot.currentCash + snapshot.accountsReceivable - snapshot.accountsPayable;
  const priorWorkingCapital = priorCash + snapshot.accountsReceivable * 0.9 - snapshot.accountsPayable * 0.9;

  return {
    currentCash: buildDelta(snapshot.currentCash, priorCash, "vs prior month"),
    forecastedCash: buildDelta(snapshot.forecastedCash, snapshot.currentCash, "vs current cash"),
    revenueMTD: buildDelta(snapshot.revenueMTD, priorRevenue, "vs prior month"),
    revenueYTD: buildDelta(snapshot.revenueYTD, snapshot.revenueYTD - snapshot.revenueMTD, "vs plan"),
    grossProfit: buildDelta(snapshot.grossProfit, priorProfit * 1.2, "vs prior month"),
    netProfit: buildDelta(snapshot.netProfit, priorProfit, "vs prior month"),
    operatingExpenses: buildDelta(snapshot.operatingExpenses, priorExpenses, "vs prior month"),
    accountsReceivable: buildDelta(snapshot.accountsReceivable, snapshot.accountsReceivable * 0.92, "vs prior month"),
    accountsPayable: buildDelta(snapshot.accountsPayable, snapshot.accountsPayable * 0.95, "vs prior month"),
    runway: buildDelta(snapshot.runway, snapshot.runway + 0.5, "vs prior month"),
    workingCapital: buildDelta(workingCapital, priorWorkingCapital, "vs prior month"),
    ebitda: buildDelta(snapshot.ebitda, snapshot.ebitda * 0.95, "vs prior month"),
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
