import {
  countForecastVersions,
  fetchFinancialSnapshotRow,
  fetchKpiOverrideRows,
  fetchMonthlyTrendRows,
  fetchOrganizationSettingsJson,
  insertForecastVersionRow,
  updateFinancialSnapshotComputed,
  updateOrganizationDataSource,
  upsertCashForecastMonthRow,
  upsertCashForecastWeekRow,
  upsertKpiComputedRow,
} from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";
import {
  aggregateMonthlyForecast,
  buildForecastInputFromSnapshot,
  calculateRunwayWeeks,
  calculateWeeklyBurn,
  generateDeterministicWeeklyForecast,
} from "@/lib/forecast/compute";
import { computeKpis } from "@/lib/kpi/catalog";
import { computeWorkingCapital } from "@/lib/financial/deltas";
import { completeJobRun, logOperationalEvent, startJobRun } from "@/lib/observability/events";
import type { FinancialSnapshot, MonthlyTrend } from "@/lib/types";

export interface RecomputeResult {
  success: boolean;
  forecastWeeks: number;
  kpisUpdated: number;
  error?: string;
}

export async function recomputeTenantFinancials(
  organizationId: string,
  options?: { cashAlertThreshold?: number }
): Promise<RecomputeResult> {
  const jobId = await startJobRun(organizationId, "forecast_recompute");

  try {
    if (!isPersistentDataBackendAvailable()) {
      return { success: false, forecastWeeks: 0, kpisUpdated: 0, error: "Database not configured" };
    }

    const [snapshotRow, trendsRows, settings] = await Promise.all([
      fetchFinancialSnapshotRow(organizationId),
      fetchMonthlyTrendRows(organizationId),
      fetchOrganizationSettingsJson(organizationId),
    ]);

    if (!snapshotRow) {
      await completeJobRun(jobId, "failed", "No financial snapshot");
      return { success: false, forecastWeeks: 0, kpisUpdated: 0, error: "No financial snapshot" };
    }

    const cashAlertThreshold = options?.cashAlertThreshold ?? Number(settings.cashAlertThreshold ?? 150000);

    const snapshot = mapSnapshot(snapshotRow);
    const trends: MonthlyTrend[] = trendsRows.map((r) => ({
      month: r.month as string,
      revenue: Number(r.revenue),
      expenses: Number(r.expenses),
      profit: Number(r.profit),
      cash: Number(r.cash),
    }));

    const input = buildForecastInputFromSnapshot(snapshot);
    const weeks = generateDeterministicWeeklyForecast(input, 13, 1, cashAlertThreshold);
    const months = aggregateMonthlyForecast(weeks);
    const weeklyBurn = calculateWeeklyBurn(weeks);
    const runwayWeeks = calculateRunwayWeeks(snapshot.currentCash, weeklyBurn);
    const runwayMonths = Math.round((runwayWeeks / 4.33) * 10) / 10;
    const forecastedCash = weeks[weeks.length - 1]?.endingBalance ?? snapshot.currentCash;

    await updateFinancialSnapshotComputed(organizationId, {
      forecasted_cash: forecastedCash,
      burn_rate: Math.round(weeklyBurn * 4.33),
      runway: runwayMonths,
      updated_at: new Date().toISOString(),
    });

    for (const week of weeks) {
      await upsertCashForecastWeekRow(organizationId, {
        week_num: week.week,
        week_start: week.weekStart,
        week_end: week.weekEnd,
        starting_balance: week.startingBalance,
        inflows: week.inflows,
        outflows: week.outflows,
        ending_balance: week.endingBalance,
        is_risk_period: week.isRiskPeriod,
      });
    }

    for (const month of months) {
      await upsertCashForecastMonthRow(organizationId, {
        month_label: month.month,
        inflows: month.inflows,
        outflows: month.outflows,
        ending_balance: month.endingBalance,
        is_risk_period: month.isRiskPeriod,
      });
    }

    const existingKpis = await fetchKpiOverrideRows(organizationId);
    const manualKeys = new Set(
      existingKpis.filter((k) => k.manual_override).map((k) => k.kpi_key)
    );
    const enabledKeys = existingKpis
      .filter((k) => k.enabled !== false)
      .map((k) => k.kpi_key);

    const computed = computeKpis(
      { snapshot: { ...snapshot, runway: runwayMonths }, trends },
      enabledKeys.length ? enabledKeys : undefined
    );

    let kpisUpdated = 0;
    for (const kpi of computed) {
      if (manualKeys.has(kpi.key)) continue;
      await upsertKpiComputedRow(organizationId, {
        kpi_key: kpi.key,
        name: kpi.name,
        value: kpi.value,
        unit: kpi.unit,
        change: kpi.change,
        change_label: kpi.changeLabel,
        target: kpi.target ?? null,
        status: kpi.status ?? null,
        enabled: true,
        updated_at: new Date().toISOString(),
      });
      kpisUpdated++;
    }

    const versionCount = await countForecastVersions(organizationId);

    await insertForecastVersionRow(organizationId, {
      version_num: versionCount + 1,
      ending_cash: forecastedCash,
      minimum_cash: Math.min(...weeks.map((w) => w.endingBalance)),
      assumptions_snapshot: input,
    });

    await updateOrganizationDataSource(organizationId, trends.length > 0 ? "imported" : "computed");

    await completeJobRun(jobId, "success");
    return { success: true, forecastWeeks: weeks.length, kpisUpdated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recompute failed";
    logOperationalEvent("forecast_recompute_failed", { organizationId, message });
    await completeJobRun(jobId, "failed", message);
    return { success: false, forecastWeeks: 0, kpisUpdated: 0, error: message };
  }
}

function mapSnapshot(row: Record<string, unknown>): FinancialSnapshot {
  return {
    currentCash: Number(row.current_cash),
    forecastedCash: Number(row.forecasted_cash),
    revenueMTD: Number(row.revenue_mtd),
    revenueYTD: Number(row.revenue_ytd),
    grossProfit: Number(row.gross_profit),
    netProfit: Number(row.net_profit),
    operatingExpenses: Number(row.operating_expenses),
    accountsReceivable: Number(row.accounts_receivable),
    accountsPayable: Number(row.accounts_payable),
    burnRate: Number(row.burn_rate),
    runway: Number(row.runway),
    debtObligations: Number(row.debt_obligations),
    payrollObligations: Number(row.payroll_obligations),
    ebitda: Number(row.ebitda),
  };
}

export { computeWorkingCapital };
