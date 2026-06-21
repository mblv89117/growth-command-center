"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CashTrendLine, TrendChart } from "@/components/charts";
import { AlertItem, PageHeader } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant/context";
import { getTenantData } from "@/lib/mock-data";
import type { DashboardData } from "@/lib/data/dashboard";
import { formatCurrency } from "@/lib/utils";
import { activeMonthlyTrends, latestTrendMonthLabel } from "@/lib/forecast/validate";
import { AiAdvisorPanel } from "@/components/dashboard/ai-advisor-panel";
import { OnboardingCta } from "@/components/dashboard/onboarding-cta";
import { KpiList } from "@/components/dashboard/kpi-list";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { organization } = useTenant();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?organizationId=${organization.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Dashboard API ${res.status}`);
        return res.json() as Promise<DashboardData>;
      })
      .then((json) => setData(json))
      .catch(() => {
        const mock = getTenantData(organization.id);
        setData({
          financialSnapshot: mock.financialSnapshot,
          monthlyTrends: mock.monthlyTrends,
          budgetVsActual: mock.budgetVsActual,
          kpis: mock.kpis,
          alerts: mock.alerts,
          source: "mock",
        });
      })
      .finally(() => setLoading(false));
  }, [organization.id]);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { financialSnapshot, monthlyTrends, alerts, kpis, budgetVsActual, source } = data;
  const chartTrends = activeMonthlyTrends(monthlyTrends);
  const budgetPeriodLabel = latestTrendMonthLabel(monthlyTrends);
  const criticalAlerts = alerts.filter((a) => !a.isRead && (a.severity === "critical" || a.severity === "high"));

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description={`Real-time financial overview for ${organization.name}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={source === "supabase" ? "success" : "secondary"}>
              {source === "supabase" ? "Live Data" : "Mock Data"}
            </Badge>
            <Button asChild>
              <Link href="/cash-forecast">
                View Cash Forecast <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <OnboardingCta />

      <div className="mb-6">
        <AiAdvisorPanel department="executive" />
      </div>

      {criticalAlerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">{criticalAlerts.length} Active Risk Alerts</h3>
          </div>
          <div className="space-y-3">
            {criticalAlerts.slice(0, 2).map((alert) => (
              <AlertItem key={alert.id} {...alert} />
            ))}
          </div>
          {criticalAlerts.length > 2 && (
            <Button variant="link" className="mt-2 px-0" asChild>
              <Link href="/alerts">View all alerts</Link>
            </Button>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Current Cash"
          value={financialSnapshot.currentCash}
          change={3.2}
          changeLabel="vs last month"
          variant="success"
        />
        <MetricCard
          title="Forecasted Cash (13wk)"
          value={financialSnapshot.forecastedCash}
          change={-2.8}
          changeLabel="end of period"
          variant="warning"
        />
        <MetricCard
          title="Revenue MTD"
          value={financialSnapshot.revenueMTD}
          change={12.4}
          changeLabel="vs last month"
        />
        <MetricCard
          title="Revenue YTD"
          value={financialSnapshot.revenueYTD}
          change={8.6}
          changeLabel="vs plan"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Gross Profit" value={financialSnapshot.grossProfit} format="currency" />
        <MetricCard title="Net Profit" value={financialSnapshot.netProfit} format="currency" />
        <MetricCard title="Operating Expenses" value={financialSnapshot.operatingExpenses} format="currency" />
        <MetricCard title="EBITDA" value={financialSnapshot.ebitda} format="currency" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Accounts Receivable" value={financialSnapshot.accountsReceivable} format="currency" />
        <MetricCard title="Accounts Payable" value={financialSnapshot.accountsPayable} format="currency" />
        <MetricCard
          title="Burn Rate"
          value={financialSnapshot.burnRate}
          subtitle="monthly avg"
          format="currency"
        />
        <MetricCard
          title="Runway"
          value={financialSnapshot.runway}
          format="months"
          variant="warning"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
            <CardDescription>Revenue, expenses, and profit trends</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={chartTrends} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cash Position Trend</CardTitle>
            <CardDescription>Monthly cash balance movement</CardDescription>
          </CardHeader>
          <CardContent>
            <CashTrendLine data={chartTrends.map((m) => ({ month: m.month, cash: m.cash }))} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Budget vs Actual</CardTitle>
            <CardDescription>{budgetPeriodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {budgetVsActual.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.category}</span>
                      <span className="font-medium">{formatCurrency(item.actual)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Budget: {formatCurrency(item.budget)}</span>
                      <Badge
                        variant={item.variance >= 0 ? "success" : "destructive"}
                        className="text-xs"
                      >
                        {item.variance >= 0 ? "+" : ""}
                        {item.variancePercent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <KpiList
          kpis={kpis}
          organizationId={organization.id}
          onKpiUpdated={(updated) => {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    kpis: prev.kpis.map((item) => (item.id === updated.id ? updated : item)),
                  }
                : prev
            );
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Debt Obligations" value={financialSnapshot.debtObligations} format="currency" />
        <MetricCard title="Payroll Due" value={financialSnapshot.payrollObligations} format="currency" variant="warning" />
        <MetricCard
          title="Forecast vs Actual"
          value="-4.2%"
          format="number"
          subtitle="Revenue variance this month"
          variant="warning"
        />
      </div>
    </div>
  );
}
