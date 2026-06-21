"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiEditModal } from "@/components/dashboard/kpi-edit-modal";
import { hasPermission } from "@/lib/auth/permissions";
import { useTenant } from "@/lib/tenant/context";
import type { KPI, KpiStatus } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { CheckCircle2, Pencil } from "lucide-react";

interface KpiScorecardGridProps {
  kpis: KPI[];
  organizationId: string;
  onKpiUpdated: (kpi: KPI) => void;
}

function statusBadgeVariant(status: KpiStatus | undefined): "success" | "secondary" | "destructive" {
  if (status === "green") return "success";
  if (status === "red") return "destructive";
  return "secondary";
}

function formatKpiValue(kpi: KPI): string {
  if (kpi.unit === "currency") return formatCurrency(kpi.value, true);
  if (kpi.unit === "percent") return `${kpi.value}%`;
  if (kpi.unit === "days") return `${kpi.value} days`;
  return String(kpi.value);
}

export function KpiScorecardGrid({ kpis, organizationId, onKpiUpdated }: KpiScorecardGridProps) {
  const { user } = useTenant();
  const canEdit = hasPermission(user.role, "financials:write");
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const onTarget = kpi.target != null ? kpi.value >= kpi.target : undefined;

          return (
            <div key={kpi.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">{kpi.name}</p>
                    {kpi.status && (
                      <Badge variant={statusBadgeVariant(kpi.status)} className="text-[10px] capitalize">
                        {kpi.status}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onTarget !== undefined && (
                    <CheckCircle2
                      className={cn("h-4 w-4", onTarget ? "text-success" : "text-warning")}
                    />
                  )}
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
              <p className="mt-2 text-xl font-bold">{formatKpiValue(kpi)}</p>
              {kpi.target != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Target:{" "}
                  {kpi.unit === "currency"
                    ? formatCurrency(kpi.target, true)
                    : kpi.unit === "percent"
                      ? `${kpi.target}%`
                      : kpi.target}
                </p>
              )}
              {kpi.plan && (
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{kpi.plan}</p>
              )}
            </div>
          );
        })}
      </div>

      {editingKpi && (
        <KpiEditModal
          kpi={editingKpi}
          organizationId={organizationId}
          open={Boolean(editingKpi)}
          onClose={() => setEditingKpi(null)}
          onSaved={(updated) => {
            onKpiUpdated(updated);
            setEditingKpi(null);
          }}
        />
      )}
    </>
  );
}
