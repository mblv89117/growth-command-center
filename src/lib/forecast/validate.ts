import type { CashForecastWeek, MonthlyTrend } from "@/lib/types";

export function validateCashForecastWeeks(weeks: CashForecastWeek[]): string[] {
  const errors: string[] = [];

  weeks.forEach((week, index) => {
    const expectedEnding = week.startingBalance + week.inflows - week.outflows;
    if (Math.abs(expectedEnding - week.endingBalance) > 0.5) {
      errors.push(
        `Week ${week.week}: ending balance ${week.endingBalance} != ${expectedEnding} (start + in - out)`
      );
    }

    if (index > 0 && weeks[index - 1].endingBalance !== week.startingBalance) {
      errors.push(
        `Week ${week.week}: starting balance ${week.startingBalance} != prior ending ${weeks[index - 1].endingBalance}`
      );
    }
  });

  return errors;
}

export function activeMonthlyTrends(trends: MonthlyTrend[]): MonthlyTrend[] {
  return trends.filter((t) => t.revenue > 0 || t.expenses > 0 || t.cash > 0);
}

export function latestTrendMonthLabel(trends: MonthlyTrend[]): string {
  const active = activeMonthlyTrends(trends);
  const latest = active[active.length - 1];
  return latest ? `${latest.month} performance variance` : "Current period variance";
}
