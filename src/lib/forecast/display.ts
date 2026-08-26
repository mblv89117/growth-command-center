import { isCashRiskPeriod } from "@/lib/forecast/compute";
import { getScenarioMultiplier } from "@/lib/forecast-engine";
import type { CashForecastWeek, ScenarioType } from "@/lib/types";

export const INSUFFICIENT_DATA = "INSUFFICIENT_DATA" as const;

export interface WeeklyForecastDisplay {
  provenance: typeof INSUFFICIENT_DATA | "CALCULATED";
  scenariosEnabled: boolean;
  weeks: CashForecastWeek[];
  endingWeek13: number | null;
  minCash: number | null;
  riskWeekCount: number;
  riskCopy: string;
  emptyStateCopy: string;
}

/**
 * Scale SOURCE-DERIVED/CALCULATED weeks only. Empty series stay empty —
 * never invent a 13-week mix from snapshot percents.
 */
export function applyForecastScenario(
  weeks: CashForecastWeek[],
  type: ScenarioType,
  ownerCashAlertThreshold?: number | null
): CashForecastWeek[] {
  if (!Array.isArray(weeks) || weeks.length === 0) return [];

  const multiplier = getScenarioMultiplier(type);
  if (multiplier === 1) return weeks;

  let balance = weeks[0].startingBalance;
  return weeks.map((week) => {
    const inflows = Math.round(week.inflows * multiplier);
    const startingBalance = balance;
    const endingBalance = startingBalance + inflows - week.outflows;
    balance = endingBalance;
    return {
      ...week,
      startingBalance,
      inflows,
      endingBalance,
      isRiskPeriod: isCashRiskPeriod(endingBalance, ownerCashAlertThreshold),
    };
  });
}

function finiteEndingBalances(weeks: CashForecastWeek[]): number[] {
  return weeks
    .map((week) => week.endingBalance)
    .filter((value): value is number => Number.isFinite(value));
}

/**
 * Fail-closed weekly forecast presentation.
 * Empty / missing weeks are INSUFFICIENT_DATA — no $0 week-13, no −Infinity min cash,
 * no "risk periods identified" copy as if a model ran.
 */
export function summarizeWeeklyForecastDisplay(
  weeks: CashForecastWeek[] | null | undefined
): WeeklyForecastDisplay {
  const sourceWeeks = Array.isArray(weeks) ? weeks : [];

  if (sourceWeeks.length === 0) {
    return {
      provenance: INSUFFICIENT_DATA,
      scenariosEnabled: false,
      weeks: [],
      endingWeek13: null,
      minCash: null,
      riskWeekCount: 0,
      riskCopy:
        "INSUFFICIENT_DATA — no weekly forecast ran, so risk periods were not identified.",
      emptyStateCopy:
        "INSUFFICIENT_DATA. No SOURCE-DERIVED or CALCULATED weekly cash forecast. Import or connect books — this page will not invent a 13-week series.",
    };
  }

  const balances = finiteEndingBalances(sourceWeeks);
  const week13 = sourceWeeks.find((week) => week.week === 13);
  const endingWeek13 =
    week13 && Number.isFinite(week13.endingBalance) ? week13.endingBalance : null;
  const minCash = balances.length > 0 ? Math.min(...balances) : null;
  const riskWeekCount = sourceWeeks.filter((week) => week.isRiskPeriod).length;

  return {
    provenance: "CALCULATED",
    scenariosEnabled: true,
    weeks: sourceWeeks,
    endingWeek13,
    minCash,
    riskWeekCount,
    riskCopy:
      riskWeekCount > 0
        ? `${riskWeekCount} risk period${riskWeekCount !== 1 ? "s" : ""} identified from SOURCE-DERIVED negative cash or owner cash-alert target`
        : "No cash-risk periods identified from SOURCE-DERIVED negative cash or owner cash-alert target",
    emptyStateCopy: "",
  };
}

export function metricOrInsufficient(value: number | null | undefined): number | typeof INSUFFICIENT_DATA {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return INSUFFICIENT_DATA;
  }
  return value;
}
