import {
  APEX_DEMO_ORGANIZATION_ID,
  getTenantData,
} from "@/lib/mock-data";
import type { FinancialSnapshot, MonthlyTrend, TenantData } from "@/lib/types";

export type Provenance = "SOURCE-DERIVED" | "CALCULATED" | "AI-INFERRED" | "DEMO";

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

export function snapshotFromImportRow(
  row: Record<string, string | number>
): FinancialSnapshot {
  const n = (key: string): number => parseOptionalNumber(row[key]) ?? 0;
  return {
    currentCash: n("current_cash"),
    forecastedCash: n("forecasted_cash"),
    revenueMTD: n("revenue_mtd"),
    revenueYTD: n("revenue_ytd"),
    grossProfit: n("gross_profit"),
    netProfit: n("net_profit"),
    operatingExpenses: n("operating_expenses"),
    accountsReceivable: n("accounts_receivable"),
    accountsPayable: n("accounts_payable"),
    burnRate: n("burn_rate"),
    runway: n("runway"),
    debtObligations: n("debt_obligations"),
    payrollObligations: n("payroll_obligations"),
    ebitda: n("ebitda"),
  };
}

/**
 * Overlay SOURCE-DERIVED import numbers onto the tenant shell.
 * Never copies Apex jobs/invoices/cash onto another org.
 */
export function applyImportedFinancials(
  organizationId: string,
  snapshot: FinancialSnapshot,
  trends: MonthlyTrend[] = []
): TenantData & { financialProvenance: Provenance; dataSource: "imported" } {
  const shell = getTenantData(organizationId);
  if (organizationId === APEX_DEMO_ORGANIZATION_ID) {
    return {
      ...shell,
      financialSnapshot: snapshot,
      monthlyTrends: trends.length ? trends : shell.monthlyTrends,
      financialProvenance: "DEMO",
      dataSource: "imported",
    };
  }

  return {
    ...shell,
    financialSnapshot: snapshot,
    monthlyTrends: trends,
    jobs: [],
    invoices: [],
    bills: [],
    transactions: [],
    financialProvenance: "SOURCE-DERIVED",
    dataSource: "imported",
  };
}
