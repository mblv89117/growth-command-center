import type { CashForecastWeek, ForecastInput, Scenario } from "@/lib/types";
import { generateDeterministicWeeklyForecast } from "@/lib/forecast/compute";

export function generateWeeklyForecast(
  input: ForecastInput,
  weeks = 13,
  scenarioMultiplier = 1
): CashForecastWeek[] {
  return generateDeterministicWeeklyForecast(input, weeks, scenarioMultiplier);
}

export function calculateRunway(currentCash: number, weeklyBurn: number): number {
  if (weeklyBurn <= 0) return 0;
  return Math.round((currentCash / weeklyBurn) * 10) / 10;
}

export function calculateMinimumCash(weeks: CashForecastWeek[]): number | null {
  if (!Array.isArray(weeks) || weeks.length === 0) return null;
  const balances = weeks
    .map((w) => w.endingBalance)
    .filter((value): value is number => Number.isFinite(value));
  if (balances.length === 0) return null;
  return Math.min(...balances);
}

export function applyScenarioMultiplier(
  scenario: Scenario,
  baseInput: ForecastInput
): ForecastInput {
  const revenueMultiplier = 1 + scenario.revenueGrowthRate / 100;
  const expenseMultiplier = 1 + scenario.expenseIncreaseRate / 100;

  return {
    ...baseInput,
    sales: baseInput.sales * revenueMultiplier,
    recurringRevenue: baseInput.recurringRevenue * revenueMultiplier,
    oneTimeRevenue: baseInput.oneTimeRevenue * revenueMultiplier,
    receivables: baseInput.receivables * revenueMultiplier,
    payroll: baseInput.payroll * expenseMultiplier,
    operatingExpenses: baseInput.operatingExpenses * expenseMultiplier,
    materials: baseInput.materials * expenseMultiplier,
    subcontractors: baseInput.subcontractors * expenseMultiplier,
  };
}

export function getScenarioMultiplier(type: Scenario["type"]): number {
  switch (type) {
    case "best":
      return 1.15;
    case "worst":
      return 0.75;
    case "growth":
      return 1.25;
    case "downside":
      return 0.85;
    default:
      return 1;
  }
}
