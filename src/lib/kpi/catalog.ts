import type { FinancialSnapshot, KPI, MonthlyTrend } from "@/lib/types";

export interface KpiDefinition {
  key: string;
  name: string;
  unit: KPI["unit"];
  category: "growth" | "profitability" | "cash" | "efficiency" | "sales" | "operations";
  compute: (ctx: KpiComputeContext) => number | null;
  defaultTarget?: number;
}

export interface KpiComputeContext {
  snapshot: FinancialSnapshot;
  trends: MonthlyTrend[];
  priorSnapshot?: Partial<FinancialSnapshot>;
}

export const KPI_CATALOG: KpiDefinition[] = [
  {
    key: "revenue_growth",
    name: "Revenue Growth",
    unit: "percent",
    category: "growth",
    defaultTarget: 10,
    compute: (ctx) => {
      if (ctx.trends.length < 2) return null;
      const latest = ctx.trends[ctx.trends.length - 1];
      const prior = ctx.trends[ctx.trends.length - 2];
      if (prior.revenue === 0) return null;
      return Math.round(((latest.revenue - prior.revenue) / prior.revenue) * 1000) / 10;
    },
  },
  {
    key: "gross_margin",
    name: "Gross Margin",
    unit: "percent",
    category: "profitability",
    defaultTarget: 35,
    compute: (ctx) => {
      if (ctx.snapshot.revenueMTD === 0) return null;
      return Math.round((ctx.snapshot.grossProfit / ctx.snapshot.revenueMTD) * 1000) / 10;
    },
  },
  {
    key: "net_margin",
    name: "Net Margin",
    unit: "percent",
    category: "profitability",
    defaultTarget: 15,
    compute: (ctx) => {
      if (ctx.snapshot.revenueMTD === 0) return null;
      return Math.round((ctx.snapshot.netProfit / ctx.snapshot.revenueMTD) * 1000) / 10;
    },
  },
  {
    key: "ebitda_margin",
    name: "EBITDA Margin",
    unit: "percent",
    category: "profitability",
    defaultTarget: 20,
    compute: (ctx) => {
      if (ctx.snapshot.revenueMTD === 0) return null;
      return Math.round((ctx.snapshot.ebitda / ctx.snapshot.revenueMTD) * 1000) / 10;
    },
  },
  {
    key: "ar_days",
    name: "AR Days",
    unit: "days",
    category: "cash",
    defaultTarget: 45,
    compute: (ctx) => {
      if (ctx.snapshot.revenueMTD === 0) return null;
      const dailyRevenue = ctx.snapshot.revenueMTD / 30;
      return Math.round(ctx.snapshot.accountsReceivable / dailyRevenue);
    },
  },
  {
    key: "ap_days",
    name: "AP Days",
    unit: "days",
    category: "cash",
    defaultTarget: 30,
    compute: (ctx) => {
      if (ctx.snapshot.operatingExpenses === 0) return null;
      const dailyExpense = ctx.snapshot.operatingExpenses / 30;
      return Math.round(ctx.snapshot.accountsPayable / dailyExpense);
    },
  },
  {
    key: "cash_runway",
    name: "Cash Runway",
    unit: "number",
    category: "cash",
    defaultTarget: 6,
    compute: (ctx) => ctx.snapshot.runway,
  },
  {
    key: "opex_ratio",
    name: "OpEx Ratio",
    unit: "percent",
    category: "efficiency",
    defaultTarget: 25,
    compute: (ctx) => {
      if (ctx.snapshot.revenueMTD === 0) return null;
      return Math.round((ctx.snapshot.operatingExpenses / ctx.snapshot.revenueMTD) * 1000) / 10;
    },
  },
  {
    key: "labor_pct",
    name: "Labor %",
    unit: "percent",
    category: "efficiency",
    defaultTarget: 35,
    compute: (ctx) => {
      if (ctx.snapshot.revenueMTD === 0) return null;
      return Math.round((ctx.snapshot.payrollObligations / ctx.snapshot.revenueMTD) * 1000) / 10;
    },
  },
  {
    key: "working_capital",
    name: "Working Capital",
    unit: "currency",
    category: "cash",
    compute: (ctx) =>
      ctx.snapshot.currentCash + ctx.snapshot.accountsReceivable - ctx.snapshot.accountsPayable,
  },
];

export function computeKpis(
  ctx: KpiComputeContext,
  enabledKeys?: string[]
): Array<Omit<KPI, "id"> & { key: string }> {
  const enabled = enabledKeys ?? KPI_CATALOG.map((k) => k.key);
  return KPI_CATALOG.filter((def) => enabled.includes(def.key))
    .map((def) => {
      const value = def.compute(ctx);
      if (value === null) return null;
      const priorValue = def.compute({ ...ctx, snapshot: { ...ctx.snapshot, ...(ctx.priorSnapshot ?? {}) } });
      const change =
        priorValue !== null && priorValue !== 0
          ? Math.round(((value - priorValue) / Math.abs(priorValue)) * 1000) / 10
          : 0;
      return {
        key: def.key,
        name: def.name,
        value,
        unit: def.unit,
        change,
        changeLabel: "vs prior period",
        target: def.defaultTarget,
        status: suggestStatus(value, def.defaultTarget, def.unit),
        manualOverride: false,
      };
    })
    .filter((k): k is NonNullable<typeof k> => k !== null);
}

function suggestStatus(
  value: number,
  target: number | undefined,
  unit: KPI["unit"]
): KPI["status"] {
  if (target === undefined) return "green";
  const tolerance = unit === "percent" ? 5 : unit === "days" ? 10 : target * 0.1;
  if (unit === "days" || (unit === "percent" && target < value)) {
    if (value <= target) return "green";
    if (value <= target + tolerance) return "yellow";
    return "red";
  }
  if (value >= target) return "green";
  if (value >= target - tolerance) return "yellow";
  return "red";
}
