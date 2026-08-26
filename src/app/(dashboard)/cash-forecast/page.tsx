"use client";

import { useState } from "react";
import { CashForecastChart } from "@/components/charts";
import { DataSourceBanner, DataTable, PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTenantData } from "@/hooks/use-tenant-data";
import {
  applyForecastScenario,
  INSUFFICIENT_DATA,
  metricOrInsufficient,
  summarizeWeeklyForecastDisplay,
} from "@/lib/forecast/display";
import type { ScenarioType } from "@/lib/types";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function ForecastEmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{INSUFFICIENT_DATA}</p>
      <p className="mt-2">{copy}</p>
    </div>
  );
}

export default function CashForecastPage() {
  const { data, source, loading } = useTenantData();
  const [scenario, setScenario] = useState<ScenarioType>("base");
  const display = summarizeWeeklyForecastDisplay(
    applyForecastScenario(data.cashForecastWeeks, scenario)
  );
  const hasWeeklyForecast = display.provenance !== INSUFFICIENT_DATA;

  const chartData = display.weeks.map((w) => ({
    week: `W${w.week}`,
    balance: w.endingBalance,
    inflows: w.inflows,
    outflows: w.outflows,
  }));

  const tableData = display.weeks.map((w) => ({
    week: `Week ${w.week}`,
    period: `${formatShortDate(w.weekStart)} – ${formatShortDate(w.weekEnd)}`,
    starting: w.startingBalance,
    inflows: w.inflows,
    outflows: w.outflows,
    ending: w.endingBalance,
    status: w.isRiskPeriod ? "Risk" : "OK",
  }));

  const startingCash =
    data.financialSnapshot.currentCash !== 0
      ? data.financialSnapshot.currentCash
      : INSUFFICIENT_DATA;
  const endingWeek13 = metricOrInsufficient(display.endingWeek13);
  const minCash = metricOrInsufficient(display.minCash);
  const runway =
    data.financialSnapshot.runway > 0 ? data.financialSnapshot.runway : INSUFFICIENT_DATA;

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
        description={
          hasWeeklyForecast
            ? "13-week rolling cash forecast with scenario analysis"
            : "INSUFFICIENT_DATA — no weekly forecast until SOURCE-DERIVED or CALCULATED weeks exist"
        }
      />
      <DataSourceBanner source={source} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Starting Cash" value={startingCash} />
        <MetricCard
          title="Ending Cash (Wk 13)"
          value={endingWeek13}
          variant={
            typeof display.minCash === "number" && display.minCash < 150000
              ? "warning"
              : "default"
          }
        />
        <MetricCard
          title="Minimum Cash Point"
          value={minCash}
          variant={typeof display.minCash === "number" ? "danger" : "default"}
        />
        <MetricCard
          title="Runway"
          value={runway}
          format={typeof runway === "number" ? "months" : "number"}
          variant={typeof runway === "number" && runway < 6 ? "warning" : "default"}
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
                  <CardDescription>{display.riskCopy}</CardDescription>
                </div>
                {display.scenariosEnabled ? (
                  <div className="flex gap-2">
                    {(["base", "best", "worst"] as ScenarioType[]).map((s) => (
                      <button
                        key={s}
                        type="button"
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
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {hasWeeklyForecast ? (
                <CashForecastChart data={chartData} />
              ) : (
                <ForecastEmptyState copy={display.emptyStateCopy} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="6-month">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Cash Forecast</CardTitle>
              <CardDescription>
                {data.cashForecastMonths.length > 0
                  ? "6-month projection with risk periods highlighted"
                  : "INSUFFICIENT_DATA — no monthly forecast series"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.cashForecastMonths.length > 0 ? (
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
              ) : (
                <ForecastEmptyState copy={display.emptyStateCopy} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assumptions">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Assumptions</CardTitle>
              <CardDescription>
                {data.forecastAssumptions.length > 0
                  ? "Inputs driving the cash forecast model"
                  : "INSUFFICIENT_DATA — no SOURCE-DERIVED forecast assumptions"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.forecastAssumptions.length > 0 ? (
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
              ) : (
                <ForecastEmptyState copy={display.emptyStateCopy} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>13-Week Forecast Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {hasWeeklyForecast ? (
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
          ) : (
            <ForecastEmptyState copy={display.emptyStateCopy} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
