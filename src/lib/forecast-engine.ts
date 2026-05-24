import type { CashForecastWeek, ForecastInput, Scenario } from "@/lib/types";

export function generateWeeklyForecast(
  input: ForecastInput,
  weeks = 13,
  scenarioMultiplier = 1
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

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const inflows = Math.round(weeklyInflow * (0.9 + Math.random() * 0.2));
    const outflows = Math.round(weeklyOutflow * (0.95 + Math.random() * 0.1));
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
      isRiskPeriod: balance < 150000,
    });
  }

  return forecast;
}

export function calculateRunway(currentCash: number, weeklyBurn: number): number {
  if (weeklyBurn <= 0) return 999;
  return Math.round((currentCash / weeklyBurn) * 10) / 10;
}

export function calculateMinimumCash(weeks: CashForecastWeek[]): number {
  return Math.min(...weeks.map((w) => w.endingBalance));
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
