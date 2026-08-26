import { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateMonthlyForecast,
  buildForecastInputFromSnapshot,
  calculateRunwayWeeks,
  calculateWeeklyBurn,
  generateDeterministicWeeklyForecast,
} from "@/lib/forecast/compute";
import { computeKpis, resolveKpiTarget } from "@/lib/kpi/catalog";
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
    const admin = createAdminClient();
    if (!admin) {
      return { success: false, forecastWeeks: 0, kpisUpdated: 0, error: "Database not configured" };
    }

    const [{ data: snapshotRow }, { data: trendsRows }, { data: orgRow }] = await Promise.all([
      admin.from("gcc_financial_snapshots").select("*").eq("organization_id", organizationId).maybeSingle(),
      admin.from("gcc_monthly_trends").select("*").eq("organization_id", organizationId).order("sort_order"),
      admin.from("gcc_organizations").select("settings").eq("id", organizationId).maybeSingle(),
    ]);

    if (!snapshotRow) {
      await completeJobRun(jobId, "failed", "No financial snapshot");
      return { success: false, forecastWeeks: 0, kpisUpdated: 0, error: "No financial snapshot" };
    }

    const settings = (orgRow?.settings as Record<string, unknown>) ?? {};
    const ownerThresholdRaw = options?.cashAlertThreshold ?? settings.cashAlertThreshold;
    const cashAlertThreshold =
      typeof ownerThresholdRaw === "number" && Number.isFinite(ownerThresholdRaw) && ownerThresholdRaw > 0
        ? ownerThresholdRaw
        : typeof ownerThresholdRaw === "string" && Number.isFinite(Number(ownerThresholdRaw)) && Number(ownerThresholdRaw) > 0
          ? Number(ownerThresholdRaw)
          : null;

    const snapshot = mapSnapshot(snapshotRow);
    const trends: MonthlyTrend[] = (trendsRows ?? []).map((r) => ({
      month: r.month as string,
      revenue: Number(r.revenue),
      expenses: Number(r.expenses),
      profit: Number(r.profit),
      cash: Number(r.cash),
    }));

    const input = buildForecastInputFromSnapshot(snapshot);
    const weeks = generateDeterministicWeeklyForecast(input, 13, 1, cashAlertThreshold);
    const months = aggregateMonthlyForecast(weeks, cashAlertThreshold);
    const weeklyBurn = calculateWeeklyBurn(weeks);
    const runwayWeeks = calculateRunwayWeeks(snapshot.currentCash, weeklyBurn);
    const runwayMonths = Math.round((runwayWeeks / 4.33) * 10) / 10;
    const forecastedCash = weeks[weeks.length - 1]?.endingBalance ?? snapshot.currentCash;

    await admin
      .from("gcc_financial_snapshots")
      .update({
        forecasted_cash: forecastedCash,
        burn_rate: Math.round(weeklyBurn * 4.33),
        runway: runwayMonths,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);

    for (const week of weeks) {
      await admin.from("gcc_cash_forecast_weeks").upsert(
        {
          organization_id: organizationId,
          week_num: week.week,
          week_start: week.weekStart,
          week_end: week.weekEnd,
          starting_balance: week.startingBalance,
          inflows: week.inflows,
          outflows: week.outflows,
          ending_balance: week.endingBalance,
          is_risk_period: week.isRiskPeriod,
        },
        { onConflict: "organization_id,week_num" }
      );
    }

    for (const month of months) {
      await admin.from("gcc_cash_forecast_months").upsert(
        {
          organization_id: organizationId,
          month_label: month.month,
          inflows: month.inflows,
          outflows: month.outflows,
          ending_balance: month.endingBalance,
          is_risk_period: month.isRiskPeriod,
        },
        { onConflict: "organization_id,month_label" }
      );
    }

    const { data: existingKpis } = await admin
      .from("gcc_kpis")
      .select("kpi_key, manual_override, target, enabled")
      .eq("organization_id", organizationId);

    const manualKeys = new Set(
      (existingKpis ?? []).filter((k) => k.manual_override).map((k) => k.kpi_key as string)
    );
    const enabledKeys = (existingKpis ?? [])
      .filter((k) => k.enabled !== false)
      .map((k) => k.kpi_key as string);

    const ownerTargets: Record<string, number> = {};
    for (const row of existingKpis ?? []) {
      if (row.kpi_key !== "cash_runway_target") continue;
      const ownerTarget = resolveKpiTarget(row.target);
      if (ownerTarget !== undefined) ownerTargets.cash_runway = ownerTarget;
    }

    const computed = computeKpis(
      { snapshot: { ...snapshot, runway: runwayMonths }, trends },
      enabledKeys.length ? enabledKeys : undefined,
      ownerTargets
    );

    let kpisUpdated = 0;
    for (const kpi of computed) {
      if (manualKeys.has(kpi.key)) continue;
      await admin.from("gcc_kpis").upsert(
        {
          organization_id: organizationId,
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
        },
        { onConflict: "organization_id,kpi_key" }
      );
      kpisUpdated++;
    }

    const { count: versionCount } = await admin
      .from("gcc_forecast_versions")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    await admin.from("gcc_forecast_versions").insert({
      organization_id: organizationId,
      version_num: (versionCount ?? 0) + 1,
      ending_cash: forecastedCash,
      minimum_cash: Math.min(...weeks.map((w) => w.endingBalance)),
      assumptions_snapshot: input,
    });

    await admin
      .from("gcc_organizations")
      .update({ data_source: trends.length > 0 ? "imported" : "computed" })
      .eq("id", organizationId);

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
