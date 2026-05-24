"use client";

import { PipelineChart } from "@/components/charts";
import { DataTable, PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTenantData } from "@/hooks/use-tenant-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const stageLabels: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export default function SalesPipelinePage() {
  const { data, loading } = useTenantData();
  const { opportunities } = data;

  const totalPipeline = opportunities
    .filter((o) => o.stage !== "closed_lost")
    .reduce((sum, o) => sum + o.value, 0);
  const weightedPipeline = opportunities
    .filter((o) => o.stage !== "closed_lost" && o.stage !== "closed_won")
    .reduce((sum, o) => sum + o.weightedValue, 0);
  const openDeals = opportunities.filter(
    (o) => o.stage !== "closed_won" && o.stage !== "closed_lost"
  ).length;
  const avgDealSize = totalPipeline / (openDeals || 1);

  const stageData = ["lead", "qualified", "proposal", "negotiation"].map((stage) => {
    const deals = opportunities.filter((o) => o.stage === stage);
    return {
      stage: stageLabels[stage],
      value: deals.reduce((s, d) => s + d.value, 0),
      weighted: deals.reduce((s, d) => s + d.weightedValue, 0),
    };
  });

  const byRep = opportunities.reduce(
    (acc, o) => {
      if (!acc[o.rep]) acc[o.rep] = { rep: o.rep, deals: 0, value: 0, weighted: 0 };
      acc[o.rep].deals += 1;
      acc[o.rep].value += o.value;
      acc[o.rep].weighted += o.weightedValue;
      return acc;
    },
    {} as Record<string, { rep: string; deals: number; value: number; weighted: number }>
  );

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
        title="Sales Pipeline"
        description="Opportunities, weighted revenue forecast, and conversion metrics"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Pipeline" value={totalPipeline} />
        <MetricCard title="Weighted Pipeline" value={weightedPipeline} />
        <MetricCard title="Open Deals" value={openDeals} format="number" />
        <MetricCard title="Avg Deal Size" value={avgDealSize} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
            <CardDescription>Total vs weighted value by deal stage</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineChart data={stageData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sales by Rep</CardTitle>
            <CardDescription>Performance by sales representative</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "rep", label: "Rep" },
                { key: "deals", label: "Deals", align: "right" },
                { key: "value", label: "Pipeline", align: "right" },
                { key: "weighted", label: "Weighted", align: "right" },
              ]}
              data={Object.values(byRep).map((r) => ({
                rep: r.rep,
                deals: r.deals,
                value: r.value,
                weighted: r.weighted,
              }))}
              formatters={{
                value: (v) => formatCurrency(Number(v)),
                weighted: (v) => formatCurrency(Number(v)),
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Opportunities</CardTitle>
          <CardDescription>{openDeals} active deals in pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deal</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Value</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Probability</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Weighted</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Close Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rep</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">{o.customer}</td>
                    <td className="px-4 py-3">
                      <Badge variant={o.stage === "closed_won" ? "success" : "secondary"}>
                        {stageLabels[o.stage]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(o.value)}</td>
                    <td className="px-4 py-3 text-right">{o.probability}%</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.weightedValue)}</td>
                    <td className="px-4 py-3">{formatDate(o.expectedCloseDate)}</td>
                    <td className="px-4 py-3">{o.rep}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
