"use client";

import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
  format?: "currency" | "percent" | "number" | "months";
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  variant = "default",
  className,
  format = "currency",
}: MetricCardProps) {
  const formattedValue =
    typeof value === "number"
      ? format === "currency"
        ? formatCurrency(value, true)
        : format === "percent"
          ? `${value.toFixed(1)}%`
          : format === "months"
            ? `${value} mo`
            : value.toLocaleString()
      : value;

  const variantStyles = {
    default: "",
    success: "border-success/30",
    warning: "border-warning/30",
    danger: "border-destructive/30",
  };

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{formattedValue}</div>
        {(subtitle || change !== undefined) && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {change !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  change >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {formatPercent(change)}
              </span>
            )}
            {changeLabel && <span>{changeLabel}</span>}
            {subtitle && !changeLabel && <span>{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
