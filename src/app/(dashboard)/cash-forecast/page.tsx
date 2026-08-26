"use client";

import { useState } from "react";
import { CashForecastChart } from "@/components/charts";
import { DataSourceBanner, DataTable, PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTenantData } from "@/hooks/use-tenant-data";
import { useTenant } from "@/lib/tenant/context";
import { isCashRiskPeriod } from "@/lib/forecast/compute";
import { getScenarioMultiplier } from "@/lib/forecast-engine";
import type { CashForecastWeek, ScenarioType } from "@/lib/types";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function applyForecastScenario(
  weeks: CashForecastWeek[],
  type: ScenarioType,
  ownerCashAlertThreshold?: number | null
): CashForecastWeek[] {
  const multiplier = getScenarioMultiplier(type);
  if (multiplier === 1 || weeks.length === 0) return weeks;

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

export default function CashForecastPage() {
  const { data, source, loading } = useTenantData();
  const { organization } = useTenant();
  const ownerCashAlertThreshold = organization.settings.cashAlertThreshold;
  const [scenario, setScenario] = useState<ScenarioType>("base");
  const forecastWeeks = applyForecastScenario(
    data.cashForecastWeeks,
    scenario,
    ownerCashAlertThreshold
  );

  const chartData = forecastWeeks.map((w) => ({
    week: `W${w.week}`,
    balance: w.endingBalance,
    inflows: w.inflows,
    outflows: w.outflows,
  }));

  const minCash =
    forecastWeeks.length > 0 ? Math.min(...forecastWeeks.map((w) => w.endingBalance)) : 0;
  const riskWeeks = forecastWeeks.filter((w) => w.isRiskPeriod);
  const endingWeek13 = forecastWeeks[12]?.endingBalance;
  const hasEndingWeek13 = typeof endingWeek13 === "number";

  const tableData = forecastWeeks.map((w) => ({
    week: `Week ${w.week}`,
    period: `${formatShortDate(w.weekStart)} – ${formatShortDate(w.weekEnd)}`,
    starting: w.startingBalance,
    inflows: w.inflows,
    outflows: w.outflows,
    ending: w.endingBalance,
    status: w.isRiskPeriod ? "Risk" : "OK",
  }));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Cash Forecast"
        description="13-week rolling cash forecast with scenario analysis"
      />
      <DataSourceBanner source={source} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Starting Cash" value={data.financialSnapshot.currentCash} />
        <MetricCard
          title="Ending Cash (Wk 13)"
          value={hasEndingWeek13 ? endingWeek13 : 0}
          variant={riskWeeks.length > 0 ? "warning" : "default"}
        />
        <MetricCard
          title="Minimum Cash Point"
          value={forecastWeeks.length > 0 ? minCash : 0}
          variant={
            forecastWeeks.length > 0 && isCashRiskPeriod(minCash, ownerCashAlertThreshold)
              ? "danger"
              : "default"
          }
        />
        <MetricCard
          title="Runway"
          value={data.financialSnapshot.runway}
          format="months"
          variant="warning"
        />
      </div>

      <Tabs defaultValue="13-week" className="mb-6">
        <TabsList>
          <TabsTrigger value="13-week">13-Week View</TabsTrigger>
          <TabsTrigger value="6-month">6-Month View</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
        </TabsList>

        <TabsContent value="13-week">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Weekly Cash Forecast</CardTitle>
                  <CardDescription>
                    {riskWeeks.length} risk period{riskWeeks.length !== 1 ? "s" : ""} from SOURCE-DERIVED insolvency or owner cash-alert target
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {(["base", "best", "worst"] as ScenarioType[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScenario(s)}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                        scenario === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {s} Case
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CashForecastChart data={chartData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="6-month">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Cash Forecast</CardTitle>
              <CardDescription>6-month projection with risk periods highlighted</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "month", label: "Month" },
                  { key: "inflows", label: "Inflows", align: "right" },
                  { key: "outflows", label: "Outflows", align: "right" },
                  { key: "endingBalance", label: "Ending Balance", align: "right" },
                  { key: "status", label: "Status" },
                ]}
                data={data.cashForecastMonths.map((m) => ({
                  month: m.month,
                  inflows: m.inflows,
                  outflows: m.outflows,
                  endingBalance: m.endingBalance,
                  status: m.isRiskPeriod ? "⚠ Risk" : "✓ OK",
                }))}
                formatters={{
                  inflows: (v) => formatCurrency(Number(v)),
                  outflows: (v) => formatCurrency(Number(v)),
                  endingBalance: (v) => formatCurrency(Number(v)),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assumptions">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Assumptions</CardTitle>
              <CardDescription>Inputs driving the cash forecast model</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "category", label: "Category" },
                  { key: "type", label: "Type" },
                  { key: "amount", label: "Amount", align: "right" },
                  { key: "frequency", label: "Frequency" },
                  { key: "notes", label: "Notes" },
                ]}
                data={data.forecastAssumptions.map((a) => ({
                  category: a.category,
                  type: a.type,
                  amount: a.amount,
                  frequency: a.frequency.replace("_", " "),
                  notes: a.notes ?? "—",
                }))}
                formatters={{
                  type: (v) => (
                    <Badge variant={v === "inflow" ? "success" : "destructive"}>{String(v)}</Badge>
                  ),
                  amount: (v) => formatCurrency(Number(v)),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>13-Week Forecast Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "week", label: "Week" },
              { key: "period", label: "Period" },
              { key: "starting", label: "Starting", align: "right" },
              { key: "inflows", label: "Inflows", align: "right" },
              { key: "outflows", label: "Outflows", align: "right" },
              { key: "ending", label: "Ending", align: "right" },
              { key: "status", label: "Status" },
            ]}
            data={tableData}
            formatters={{
              starting: (v) => formatCurrency(Number(v)),
              inflows: (v) => formatCurrency(Number(v)),
              outflows: (v) => formatCurrency(Number(v)),
              ending: (v) => formatCurrency(Number(v)),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
