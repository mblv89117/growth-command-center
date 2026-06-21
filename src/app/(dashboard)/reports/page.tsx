"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared";
import { KpiScorecardGrid } from "@/components/dashboard/kpi-scorecard-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant/context";
import { useTenantData } from "@/hooks/use-tenant-data";
import { getReportTypeForId } from "@/lib/reports/config";
import type { KPI } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

function exportReport(organizationId: string, reportId: string, format: "pdf" | "excel") {
  const type = getReportTypeForId(reportId);
  if (!type) return;
  window.open(
    `/api/reports/export?organizationId=${organizationId}&type=${type}&format=${format}`,
    "_blank"
  );
}

export default function ReportsPage() {
  const { organization } = useTenant();
  const { data, loading } = useTenantData();
  const { reports } = data;
  const [kpis, setKpis] = useState<KPI[]>(data.kpis);

  useEffect(() => {
    setKpis(data.kpis);
  }, [data.kpis]);

  const categories = [...new Set(reports.map((r) => r.category))];

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
        title="Reports"
        description="CFO-grade reports ready for PDF, Excel, and board review"
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>KPI Scorecard</CardTitle>
          <CardDescription>Key performance indicators snapshot — click edit to update KPIs</CardDescription>
        </CardHeader>
        <CardContent>
          <KpiScorecardGrid
            kpis={kpis}
            organizationId={organization.id}
            onKpiUpdated={(updated) => {
              setKpis((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            }}
          />
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportReport(organization.id, "rpt-11", "pdf")}
            >
              <FileText className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportReport(organization.id, "rpt-11", "excel")}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports
              .filter((r) => r.category === category)
              .map((report) => (
                <Card key={report.id} className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{report.name}</CardTitle>
                      <Badge variant="outline">{category}</Badge>
                    </div>
                    <CardDescription>{report.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {report.lastGenerated && (
                      <p className="mb-4 text-xs text-muted-foreground">
                        Last generated: {formatDate(report.lastGenerated)}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => exportReport(organization.id, report.id, "pdf")}
                        disabled={!getReportTypeForId(report.id)}
                      >
                        <FileText className="mr-1 h-3 w-3" /> PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportReport(organization.id, report.id, "excel")}
                        disabled={!getReportTypeForId(report.id)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {report.format.map((f) => (
                        <Badge key={f} variant="secondary" className="text-xs uppercase">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
