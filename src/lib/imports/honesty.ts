import { computeKpis } from "@/lib/kpi/catalog";
import {
  APEX_DEMO_ORGANIZATION_ID,
  getTenantData,
} from "@/lib/mock-data";
import type { FinancialSnapshot, KPI, MonthlyTrend, TenantData } from "@/lib/types";

export type Provenance = "SOURCE-DERIVED" | "CALCULATED" | "AI-INFERRED" | "DEMO";
export type FieldProvenance = Provenance | "INSUFFICIENT_DATA";

export const DEFAULT_FORECAST_HORIZON_WEEKS = 13;
export const WEEKS_PER_MONTH = 4.33;

function parseOptionalNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[$,%\s]/g, "").replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export type MonthlyTrendResolution =
  | {
      ok: true;
      trend: MonthlyTrend;
      expensesProvenance: "SOURCE-DERIVED";
      profitProvenance: "SOURCE-DERIVED" | "CALCULATED";
    }
  | { ok: false; error: string };

/**
 * Resolve a monthly-trend import row without inventing expenses or profit.
 * Missing expenses is INSUFFICIENT_DATA — never revenue * 0.7.
 */
export function resolveMonthlyTrendRow(
  row: Record<string, string | number>
): MonthlyTrendResolution {
  const month = String(row.month ?? "").trim();
  const revenue = parseOptionalNumber(row.revenue);
  const expenses = parseOptionalNumber(row.expenses);
  const profit = parseOptionalNumber(row.profit);
  const cash = parseOptionalNumber(row.cash);

  if (!month) {
    return { ok: false, error: "Missing required field: month" };
  }
  if (revenue === null) {
    return { ok: false, error: "Missing required SOURCE-DERIVED field: revenue" };
  }
  if (expenses === null) {
    return {
      ok: false,
      error: "Missing SOURCE-DERIVED expenses — will not invent a percent of revenue",
    };
  }

  if (profit === null) {
    return {
      ok: true,
      trend: {
        month,
        revenue,
        expenses,
        profit: revenue - expenses,
        cash: cash ?? 0,
      },
      expensesProvenance: "SOURCE-DERIVED",
      profitProvenance: "CALCULATED",
    };
  }

  return {
    ok: true,
    trend: {
      month,
      revenue,
      expenses,
      profit,
      cash: cash ?? 0,
    },
    expensesProvenance: "SOURCE-DERIVED",
    profitProvenance: "SOURCE-DERIVED",
  };
}

export interface SnapshotFieldProvenance {
  currentCash: FieldProvenance;
  forecastedCash: FieldProvenance;
  burnRate: FieldProvenance;
  runway: FieldProvenance;
  ebitda: FieldProvenance;
}

export interface ImportedSnapshotResolution {
  snapshot: FinancialSnapshot;
  fieldProvenance: SnapshotFieldProvenance;
}

/** Runway in months when cash and monthly burn are present and burn > 0. */
export function calculateRunwayMonths(
  currentCash: number,
  burnRate: number | null
): number | null {
  if (burnRate === null || burnRate <= 0) return null;
  if (!Number.isFinite(currentCash)) return null;
  return Math.round((currentCash / burnRate) * 10) / 10;
}

/**
 * Deterministic 13-week ending cash from current cash and monthly burn.
 * Never uses revenue * percent or Apex-like inflow patterns.
 */
export function calculateForecastedCash(
  currentCash: number,
  burnRate: number | null,
  horizonWeeks = DEFAULT_FORECAST_HORIZON_WEEKS
): number | null {
  if (burnRate === null || burnRate <= 0) return null;
  if (!Number.isFinite(currentCash) || !Number.isFinite(horizonWeeks)) return null;
  const horizonMonths = horizonWeeks / WEEKS_PER_MONTH;
  return Math.round(currentCash - burnRate * horizonMonths);
}

function sourceOrZero(
  value: number | null
): { amount: number; provenance: FieldProvenance } {
  if (value === null) return { amount: 0, provenance: "INSUFFICIENT_DATA" };
  return { amount: value, provenance: "SOURCE-DERIVED" };
}

/**
 * Resolve an import row: SOURCE-DERIVED fields stay as imported.
 * Runway / forecastedCash are CALCULATED only from cash + burn.
 * Missing ebitda / burn / forecast inputs stay 0 with INSUFFICIENT_DATA.
 */
export function resolveImportedSnapshot(
  row: Record<string, string | number>,
  options?: { horizonWeeks?: number }
): ImportedSnapshotResolution {
  const currentCash = parseOptionalNumber(row.current_cash);
  const burnRate = parseOptionalNumber(row.burn_rate);
  const sourceRunway = parseOptionalNumber(row.runway);
  const sourceForecasted = parseOptionalNumber(row.forecasted_cash);
  const sourceEbitda = parseOptionalNumber(row.ebitda);
  const horizonWeeks = options?.horizonWeeks ?? DEFAULT_FORECAST_HORIZON_WEEKS;

  const calculatedRunway = calculateRunwayMonths(currentCash ?? 0, burnRate);
  const calculatedForecasted = calculateForecastedCash(currentCash ?? 0, burnRate, horizonWeeks);

  const runway =
    sourceRunway !== null
      ? { amount: sourceRunway, provenance: "SOURCE-DERIVED" as const }
      : calculatedRunway !== null
        ? { amount: calculatedRunway, provenance: "CALCULATED" as const }
        : { amount: 0, provenance: "INSUFFICIENT_DATA" as const };

  const forecastedCash =
    sourceForecasted !== null
      ? { amount: sourceForecasted, provenance: "SOURCE-DERIVED" as const }
      : calculatedForecasted !== null
        ? { amount: calculatedForecasted, provenance: "CALCULATED" as const }
        : { amount: 0, provenance: "INSUFFICIENT_DATA" as const };

  return {
    snapshot: {
      currentCash: currentCash ?? 0,
      forecastedCash: forecastedCash.amount,
      revenueMTD: parseOptionalNumber(row.revenue_mtd) ?? 0,
      revenueYTD: parseOptionalNumber(row.revenue_ytd) ?? 0,
      grossProfit: parseOptionalNumber(row.gross_profit) ?? 0,
      netProfit: parseOptionalNumber(row.net_profit) ?? 0,
      operatingExpenses: parseOptionalNumber(row.operating_expenses) ?? 0,
      accountsReceivable: parseOptionalNumber(row.accounts_receivable) ?? 0,
      accountsPayable: parseOptionalNumber(row.accounts_payable) ?? 0,
      burnRate: burnRate ?? 0,
      runway: runway.amount,
      debtObligations: parseOptionalNumber(row.debt_obligations) ?? 0,
      payrollObligations: parseOptionalNumber(row.payroll_obligations) ?? 0,
      ebitda: sourceEbitda ?? 0,
    },
    fieldProvenance: {
      currentCash: sourceOrZero(currentCash).provenance,
      forecastedCash: forecastedCash.provenance,
      burnRate: sourceOrZero(burnRate).provenance,
      runway: runway.provenance,
      ebitda: sourceOrZero(sourceEbitda).provenance,
    },
  };
}

/**
 * Fill runway / forecastedCash from cash + burn when those fields are still zeroed.
 * Does not invent Apex weeks or revenue-percent forecasts.
 */
export function enrichSnapshotWithCalculatedForecast(
  snapshot: FinancialSnapshot,
  options?: { horizonWeeks?: number }
): ImportedSnapshotResolution {
  const burnRate = snapshot.burnRate > 0 ? snapshot.burnRate : null;
  const calculatedRunway = calculateRunwayMonths(snapshot.currentCash, burnRate);
  const calculatedForecasted = calculateForecastedCash(
    snapshot.currentCash,
    burnRate,
    options?.horizonWeeks ?? DEFAULT_FORECAST_HORIZON_WEEKS
  );

  const hasSourceEbitda = snapshot.ebitda !== 0;
  const hasSourceBurn = snapshot.burnRate > 0;
  const hasSourceCash = snapshot.currentCash !== 0;

  const matchesCalculatedRunway =
    calculatedRunway !== null && snapshot.runway === calculatedRunway;
  const matchesCalculatedForecasted =
    calculatedForecasted !== null && snapshot.forecastedCash === calculatedForecasted;

  const runway =
    calculatedRunway !== null && (snapshot.runway === 0 || matchesCalculatedRunway)
      ? { amount: calculatedRunway, provenance: "CALCULATED" as const }
      : snapshot.runway > 0
        ? { amount: snapshot.runway, provenance: "SOURCE-DERIVED" as const }
        : { amount: 0, provenance: "INSUFFICIENT_DATA" as const };

  const forecastedCash =
    calculatedForecasted !== null &&
    (snapshot.forecastedCash === 0 || matchesCalculatedForecasted)
      ? { amount: calculatedForecasted, provenance: "CALCULATED" as const }
      : snapshot.forecastedCash !== 0
        ? { amount: snapshot.forecastedCash, provenance: "SOURCE-DERIVED" as const }
        : { amount: 0, provenance: "INSUFFICIENT_DATA" as const };

  return {
    snapshot: {
      ...snapshot,
      runway: runway.amount,
      forecastedCash: forecastedCash.amount,
    },
    fieldProvenance: {
      currentCash: hasSourceCash ? "SOURCE-DERIVED" : "INSUFFICIENT_DATA",
      forecastedCash: forecastedCash.provenance,
      burnRate: hasSourceBurn ? "SOURCE-DERIVED" : "INSUFFICIENT_DATA",
      runway: runway.provenance,
      ebitda: hasSourceEbitda ? "SOURCE-DERIVED" : "INSUFFICIENT_DATA",
    },
  };
}

export function snapshotFromImportRow(
  row: Record<string, string | number>
): FinancialSnapshot {
  return resolveImportedSnapshot(row).snapshot;
}

function kpisFromSnapshot(snapshot: FinancialSnapshot, trends: MonthlyTrend[]): KPI[] {
  return computeKpis({ snapshot, trends }).map((kpi) => ({
    id: kpi.key,
    name: kpi.name,
    value: kpi.value,
    unit: kpi.unit,
    change: kpi.change,
    changeLabel: kpi.changeLabel,
    target: kpi.target,
    status: kpi.status,
    manualOverride: kpi.manualOverride,
  }));
}

export type ImportedTenantData = TenantData & {
  financialProvenance: Provenance;
  dataSource: "imported";
  fieldProvenance: SnapshotFieldProvenance;
  kpiProvenance: "CALCULATED" | "DEMO" | "INSUFFICIENT_DATA";
};

/**
 * Overlay SOURCE-DERIVED import numbers onto the tenant shell.
 * Calculates runway / forecastedCash / KPIs only from fields that exist.
 * Never copies Apex jobs/invoices/forecast weeks/scenarios onto another org.
 */
export function applyImportedFinancials(
  organizationId: string,
  snapshot: FinancialSnapshot,
  trends: MonthlyTrend[] = []
): ImportedTenantData {
  const shell = getTenantData(organizationId);
  const enriched = enrichSnapshotWithCalculatedForecast(snapshot);

  if (organizationId === APEX_DEMO_ORGANIZATION_ID) {
    return {
      ...shell,
      financialSnapshot: enriched.snapshot,
      monthlyTrends: trends.length ? trends : shell.monthlyTrends,
      financialProvenance: "DEMO",
      dataSource: "imported",
      fieldProvenance: { ...enriched.fieldProvenance, currentCash: "DEMO" },
      kpiProvenance: "DEMO",
    };
  }

  const kpis = kpisFromSnapshot(enriched.snapshot, trends);

  return {
    ...shell,
    financialSnapshot: enriched.snapshot,
    monthlyTrends: trends,
    kpis,
    cashForecastWeeks: [],
    cashForecastMonths: [],
    scenarios: [],
    jobs: [],
    invoices: [],
    bills: [],
    transactions: [],
    financialProvenance: "SOURCE-DERIVED",
    dataSource: "imported",
    fieldProvenance: enriched.fieldProvenance,
    kpiProvenance: kpis.length ? "CALCULATED" : "INSUFFICIENT_DATA",
  };
}

export function isEmptyFinancialSnapshot(snapshot: FinancialSnapshot): boolean {
  return (
    snapshot.currentCash === 0 &&
    snapshot.forecastedCash === 0 &&
    snapshot.revenueMTD === 0 &&
    snapshot.revenueYTD === 0 &&
    snapshot.grossProfit === 0 &&
    snapshot.netProfit === 0 &&
    snapshot.operatingExpenses === 0 &&
    snapshot.accountsReceivable === 0 &&
    snapshot.accountsPayable === 0 &&
    snapshot.burnRate === 0 &&
    snapshot.runway === 0 &&
    snapshot.ebitda === 0
  );
}

export function dashboardFieldProvenance(
  organizationId: string,
  snapshot: FinancialSnapshot
): SnapshotFieldProvenance {
  if (organizationId === APEX_DEMO_ORGANIZATION_ID) {
    return {
      currentCash: "DEMO",
      forecastedCash: "DEMO",
      burnRate: "DEMO",
      runway: "DEMO",
      ebitda: "DEMO",
    };
  }
  return enrichSnapshotWithCalculatedForecast(snapshot).fieldProvenance;
}
