"use client";

import { cn, formatCurrency } from "@/lib/utils";
import type { AlertSeverity } from "@/lib/types";
import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const severityConfig: Record<
  AlertSeverity,
  { label: string; variant: "destructive" | "warning" | "secondary" | "outline"; icon: typeof AlertTriangle }
> = {
  critical: { label: "Critical", variant: "destructive", icon: AlertTriangle },
  high: { label: "High", variant: "warning", icon: AlertTriangle },
  medium: { label: "Medium", variant: "secondary", icon: Bell },
  low: { label: "Low", variant: "outline", icon: Info },
};

interface AlertItemProps {
  title: string;
  description: string;
  severity: AlertSeverity;
  recommendedAction: string;
  affectedMetric: string;
  owner: string;
  dueDate?: string;
  riskWindow?: string;
  isRead?: boolean;
}

export function AlertItem({
  title,
  description,
  severity,
  recommendedAction,
  affectedMetric,
  owner,
  dueDate,
  riskWindow,
  isRead,
}: AlertItemProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        !isRead && severity === "critical" && "border-destructive/40 bg-destructive/5",
        !isRead && severity === "high" && "border-warning/40 bg-warning/5",
        isRead && "opacity-75"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 rounded-lg p-2",
            severity === "critical" && "bg-destructive/10 text-destructive",
            severity === "high" && "bg-warning/10 text-warning",
            severity === "medium" && "bg-muted text-muted-foreground",
            severity === "low" && "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{title}</h4>
            <Badge variant={config.variant}>{config.label}</Badge>
            {!isRead && (
              <Badge variant="outline" className="text-primary">
                New
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Recommended Action</p>
            <p className="mt-1 text-sm">{recommendedAction}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Metric: {affectedMetric}</span>
            <span>Owner: {owner}</span>
            {dueDate && <span>Due: {dueDate}</span>}
            {riskWindow && <span>Risk Window: {riskWindow}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DataTableProps {
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  data: Array<Record<string, string | number>>;
  formatters?: Record<string, (value: string | number) => React.ReactNode>;
}

export function DataTable({ columns, data, formatters }: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 font-medium text-muted-foreground",
                  col.align === "right" && "text-right"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-4 py-3", col.align === "right" && "text-right font-medium")}
                >
                  {formatters?.[col.key]
                    ? formatters[col.key](row[col.key])
                    : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KPICard({
  name,
  value,
  unit,
  change,
  changeLabel,
  target,
}: {
  name: string;
  value: number;
  unit: "currency" | "percent" | "days" | "number";
  change: number;
  changeLabel: string;
  target?: number;
}) {
  const formatted =
    unit === "currency"
      ? formatCurrency(value, true)
      : unit === "percent"
        ? `${value.toFixed(1)}%`
        : unit === "days"
          ? `${value} days`
          : value.toFixed(1);

  const onTarget = target !== undefined ? value >= target : undefined;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{name}</p>
        {onTarget !== undefined && (
          <CheckCircle2
            className={cn("h-4 w-4", onTarget ? "text-success" : "text-warning")}
          />
        )}
      </div>
      <p className="mt-2 text-xl font-bold">{formatted}</p>
      <p className={cn("mt-1 text-xs", change >= 0 ? "text-success" : "text-destructive")}>
        {change >= 0 ? "+" : ""}
        {unit === "currency" ? `${change}%` : change} {changeLabel}
      </p>
      {target !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">
          Target: {unit === "percent" ? `${target}%` : unit === "currency" ? formatCurrency(target, true) : target}
        </p>
      )}
    </div>
  );
}
