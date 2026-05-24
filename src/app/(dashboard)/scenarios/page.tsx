"use client";

import { ScenarioChart } from "@/components/charts";
import { PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenantData } from "@/hooks/use-tenant-data";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";

const scenarioColors: Record<string, string> = {
  base: "default",
  best: "success",
  worst: "destructive",
  growth: "default",
  downside: "warning",
};

export default function ScenariosPage() {
  const { data, loading } = useTenantData();
  const { scenarios } = data;

  const chartData = scenarios.map((s) => ({
    name: s.name,
    endingCash: s.endingCash,
    minimumCash: s.minimumCash,
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
        title="Scenario Planning"
        description="Compare forecast outcomes across business scenarios"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Scenario
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scenario Comparison</CardTitle>
          <CardDescription>Ending cash vs minimum cash point by scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <ScenarioChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{scenario.name}</CardTitle>
                <Badge variant={scenarioColors[scenario.type] as "default" | "success" | "destructive" | "warning"}>
                  {scenario.type}
                </Badge>
              </div>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-xs text-muted-foreground">Ending Cash</p>
                  <p className="text-sm font-bold">{formatCurrency(scenario.endingCash, true)}</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-xs text-muted-foreground">Min Cash</p>
                  <p className="text-sm font-bold">{formatCurrency(scenario.minimumCash, true)}</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-xs text-muted-foreground">Runway</p>
                  <p className="text-sm font-bold">{scenario.runway} mo</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue Growth</span>
                  <span className="font-medium">{scenario.revenueGrowthRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collection Timing</span>
                  <span className="font-medium">{scenario.collectionTimingDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expense Increase</span>
                  <span className="font-medium">{scenario.expenseIncreaseRate}%</span>
                </div>
              </div>

              <Button variant="outline" className="mt-4 w-full" size="sm">
                Edit Assumptions
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Base Case Runway"
          value={scenarios.find((s) => s.type === "base")?.runway ?? 0}
          format="months"
        />
        <MetricCard
          title="Best Case Ending Cash"
          value={scenarios.find((s) => s.type === "best")?.endingCash ?? 0}
          variant="success"
        />
        <MetricCard
          title="Worst Case Min Cash"
          value={scenarios.find((s) => s.type === "worst")?.minimumCash ?? 0}
          variant="danger"
        />
      </div>
    </div>
  );
}
