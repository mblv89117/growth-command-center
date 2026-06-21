"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiEditModal } from "@/components/dashboard/kpi-edit-modal";
import { hasPermission } from "@/lib/auth/permissions";
import { useTenant } from "@/lib/tenant/context";
import type { KPI, KpiStatus } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface KpiListProps {
  kpis: KPI[];
  organizationId: string;
  onKpiUpdated: (kpi: KPI) => void;
}

function formatKpiValue(kpi: KPI): string {
  if (kpi.unit === "currency") return formatCurrency(kpi.value, true);
  if (kpi.unit === "percent") return `${kpi.value}%`;
  if (kpi.unit === "days") return `${kpi.value}d`;
  return String(kpi.value);
}

function statusBadgeVariant(status: KpiStatus | undefined): "success" | "secondary" | "destructive" {
  if (status === "green") return "success";
  if (status === "red") return "destructive";
  return "secondary";
}

export function KpiList({ kpis, organizationId, onKpiUpdated }: KpiListProps) {
  const { user } = useTenant();
  const canEdit = hasPermission(user.role, "financials:write");
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);

  const handleSaved = (updated: KPI) => {
    onKpiUpdated(updated);
    setEditingKpi(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Key KPIs</CardTitle>
          <CardDescription>Critical metrics at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {kpis.slice(0, 6).map((kpi) => (
              <div
                key={kpi.id}
                className="flex items-start justify-between gap-3 border-b pb-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{kpi.name}</span>
                    {kpi.status && (
                      <Badge variant={statusBadgeVariant(kpi.status)} className="text-[10px] capitalize">
                        {kpi.status}
                      </Badge>
                    )}
                  </div>
                  {kpi.target != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Target: {kpi.unit === "currency" ? formatCurrency(kpi.target, true) : kpi.target}
                    </p>
                  )}
                  {kpi.plan && (
                    <p className={cn("mt-1 line-clamp-2 text-xs text-muted-foreground")}>{kpi.plan}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatKpiValue(kpi)}</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingKpi(kpi)}
                      aria-label={`Edit ${kpi.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link href="/reports">View KPI Scorecard</Link>
          </Button>
        </CardContent>
      </Card>

      {editingKpi && (
        <KpiEditModal
          kpi={editingKpi}
          organizationId={organizationId}
          open={Boolean(editingKpi)}
          onClose={() => setEditingKpi(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
