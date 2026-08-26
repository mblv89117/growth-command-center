import type { CashForecastWeek, CashForecastMonth, ForecastInput } from "@/lib/types";

/** Deterministic weekly variance pattern (no randomness) */
const INFLOW_PATTERN = [1.0, 0.95, 1.05, 1.0, 0.98, 1.02, 1.0, 0.96, 1.04, 1.0, 0.97, 1.03, 1.0];
const OUTFLOW_PATTERN = [1.0, 1.0, 1.02, 1.0, 1.0, 1.01, 1.0, 1.0, 1.02, 1.0, 1.0, 1.01, 1.0];

export function buildForecastInputFromSnapshot(snapshot: {
  currentCash: number;
  accountsReceivable: number;
  revenueMTD: number;
  operatingExpenses: number;
  payrollObligations: number;
  accountsPayable: number;
}): ForecastInput {
  const monthlyRevenue = snapshot.revenueMTD > 0 ? snapshot.revenueMTD : 0;
  return {
    startingCash: snapshot.currentCash,
    receivables: snapshot.accountsReceivable,
    sales: monthlyRevenue * 0.6,
    recurringRevenue: monthlyRevenue * 0.4,
    oneTimeRevenue: monthlyRevenue * 0.1,
    payroll: snapshot.payrollObligations || monthlyRevenue * 0.35,
    rent: monthlyRevenue * 0.05,
    subcontractors: monthlyRevenue * 0.15,
    materials: monthlyRevenue * 0.12,
    operatingExpenses: snapshot.operatingExpenses || monthlyRevenue * 0.2,
    loanPayments: monthlyRevenue * 0.03,
    taxes: monthlyRevenue * 0.08,
    ownerDistributions: monthlyRevenue * 0.02,
    capex: monthlyRevenue * 0.04,
  };
}

/**
 * Cash-risk flags require SOURCE-DERIVED insolvency or an owner cash-alert target.
 * Do not invent endingBalance < 150000.
 */
export function isCashRiskPeriod(
  endingBalance: number,
  ownerCashAlertThreshold?: number | null
): boolean {
  if (!Number.isFinite(endingBalance)) return false;
  if (endingBalance < 0) return true;
  if (
    typeof ownerCashAlertThreshold === "number" &&
    Number.isFinite(ownerCashAlertThreshold) &&
    ownerCashAlertThreshold > 0
  ) {
    return endingBalance < ownerCashAlertThreshold;
  }
  return false;
}

export function generateDeterministicWeeklyForecast(
  input: ForecastInput,
  weeks = 13,
  scenarioMultiplier = 1,
  ownerCashAlertThreshold?: number | null
): CashForecastWeek[] {
  const weeklyInflow =
    (input.receivables / weeks +
      input.sales / weeks +
      input.recurringRevenue / 4.33 +
      input.oneTimeRevenue / weeks) *
    scenarioMultiplier;

  const weeklyOutflow =
    input.payroll / 4.33 +
    input.rent / 4.33 +
    input.subcontractors / 4.33 +
    input.materials / 4.33 +
    input.operatingExpenses / 4.33 +
    input.loanPayments / 4.33 +
    input.taxes / 13 +
    input.ownerDistributions / 13 +
    input.capex / 13;

  const forecast: CashForecastWeek[] = [];
  let balance = input.startingCash;
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const inflowFactor = INFLOW_PATTERN[i % INFLOW_PATTERN.length];
    const outflowFactor = OUTFLOW_PATTERN[i % OUTFLOW_PATTERN.length];
    const inflows = Math.round(weeklyInflow * inflowFactor);
    const outflows = Math.round(weeklyOutflow * outflowFactor);
    const startingBalance = balance;
    balance = startingBalance + inflows - outflows;

    forecast.push({
      week: i + 1,
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: weekEnd.toISOString().split("T")[0],
      startingBalance: Math.round(startingBalance),
      inflows,
      outflows,
      endingBalance: Math.round(balance),
      isRiskPeriod: isCashRiskPeriod(balance, ownerCashAlertThreshold),
    });
  }

  return forecast;
}

export function aggregateMonthlyForecast(
  weeks: CashForecastWeek[],
  ownerCashAlertThreshold?: number | null
): CashForecastMonth[] {
  const months: CashForecastMonth[] = [];
  const buckets = new Map<string, { inflows: number; outflows: number; ending: number }>();

  for (const week of weeks) {
    const label = week.weekStart.slice(0, 7);
    const bucket = buckets.get(label) ?? { inflows: 0, outflows: 0, ending: week.endingBalance };
    bucket.inflows += week.inflows;
    bucket.outflows += week.outflows;
    bucket.ending = week.endingBalance;
    buckets.set(label, bucket);
  }

  for (const [month, data] of buckets) {
    months.push({
      month,
      inflows: data.inflows,
      outflows: data.outflows,
      endingBalance: data.ending,
      isRiskPeriod: isCashRiskPeriod(data.ending, ownerCashAlertThreshold),
    });
  }

  return months.slice(0, 6);
}

export function calculateRunwayWeeks(currentCash: number, weeklyBurn: number): number {
  if (weeklyBurn <= 0) return 999;
  return Math.round((currentCash / weeklyBurn) * 10) / 10;
}

export function calculateWeeklyBurn(weeks: CashForecastWeek[]): number {
  if (weeks.length === 0) return 0;
  const totalOut = weeks.reduce((s, w) => s + w.outflows, 0);
  const totalIn = weeks.reduce((s, w) => s + w.inflows, 0);
  const netBurn = (totalOut - totalIn) / weeks.length;
  return Math.max(0, netBurn);
}
