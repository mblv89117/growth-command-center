import { createAdminClient } from "@/lib/supabase/admin";
import { enrichSnapshotWithCalculatedForecast } from "@/lib/imports/honesty";
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
  _options?: { cashAlertThreshold?: number }
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

    const snapshot = mapSnapshot(snapshotRow);
    const trends: MonthlyTrend[] = (trendsRows ?? []).map((r) => ({
      month: r.month as string,
      revenue: Number(r.revenue),
      expenses: Number(r.expenses),
      profit: Number(r.profit),
      cash: Number(r.cash),
    }));

    const settings = (orgRow?.settings as Record<string, unknown>) ?? {};
    const horizonWeeks = Number(settings.forecastHorizonWeeks ?? 13);
    const enriched = enrichSnapshotWithCalculatedForecast(snapshot, {
      horizonWeeks: Number.isFinite(horizonWeeks) && horizonWeeks > 0 ? horizonWeeks : 13,
    });

    await admin
      .from("gcc_financial_snapshots")
      .update({
        forecasted_cash: enriched.snapshot.forecastedCash,
        burn_rate: enriched.snapshot.burnRate,
        runway: enriched.snapshot.runway,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);

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

    const computed = computeKpis(
      { snapshot: enriched.snapshot, trends },
      enabledKeys.length ? enabledKeys : undefined
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

    await admin
      .from("gcc_organizations")
      .update({ data_source: trends.length > 0 ? "imported" : "computed" })
      .eq("id", organizationId);

    await completeJobRun(jobId, "success");
    return { success: true, forecastWeeks: 0, kpisUpdated };
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
