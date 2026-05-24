"use client";

import { DataTable, PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTenantData } from "@/hooks/use-tenant-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  planning: "secondary",
  active: "default",
  on_hold: "warning",
  completed: "success",
  cancelled: "destructive",
};

export default function OperationsPage() {
  const { data, loading } = useTenantData();
  const { jobs } = data;

  const activeJobs = jobs.filter((j) => j.status === "active");
  const totalContractValue = jobs.reduce((s, j) => s + j.contractValue, 0);
  const avgMargin =
    activeJobs.reduce((s, j) => s + j.actualGrossMargin, 0) / (activeJobs.length || 1);
  const totalBacklog = jobs
    .filter((j) => j.status !== "completed" && j.status !== "cancelled")
    .reduce((s, j) => s + j.contractValue * (1 - j.completionPercent / 100), 0);

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
        title="Operations"
        description="Active jobs, margins, production status, and billing timing"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Jobs" value={activeJobs.length} format="number" />
        <MetricCard title="Total Contract Value" value={totalContractValue} />
        <MetricCard title="Avg Gross Margin" value={avgMargin} format="percent" />
        <MetricCard title="Remaining Backlog" value={totalBacklog} />
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{job.name}</CardTitle>
                  <CardDescription>
                    {job.customer} · PM: {job.projectManager}
                  </CardDescription>
                </div>
                <Badge variant={statusVariant[job.status]}>
                  {job.status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium">{job.completionPercent}%</span>
                </div>
                <Progress value={job.completionPercent} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Contract Value</p>
                  <p className="font-semibold">{formatCurrency(job.contractValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Est. Margin / Actual</p>
                  <p className="font-semibold">
                    {job.estimatedGrossMargin}% /{" "}
                    <span className={job.actualGrossMargin < job.estimatedGrossMargin ? "text-destructive" : "text-success"}>
                      {job.actualGrossMargin}%
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Billing</p>
                  <p className="font-semibold">{formatDate(job.expectedBillingDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Collection</p>
                  <p className="font-semibold">{formatDate(job.expectedCollectionDate)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Labor Cost</p>
                  <p className="text-sm font-medium">{formatCurrency(job.laborCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Materials</p>
                  <p className="text-sm font-medium">{formatCurrency(job.materialCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subcontractors</p>
                  <p className="text-sm font-medium">{formatCurrency(job.subcontractorCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Job Summary Table</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "name", label: "Job" },
              { key: "status", label: "Status" },
              { key: "contractValue", label: "Contract", align: "right" },
              { key: "margin", label: "Margin", align: "right" },
              { key: "completion", label: "Complete", align: "right" },
              { key: "billing", label: "Billing Date" },
            ]}
            data={jobs.map((j) => ({
              name: j.name,
              status: j.status.replace("_", " "),
              contractValue: j.contractValue,
              margin: `${j.actualGrossMargin}%`,
              completion: `${j.completionPercent}%`,
              billing: formatDate(j.expectedBillingDate),
            }))}
            formatters={{
              contractValue: (v) => formatCurrency(Number(v)),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
