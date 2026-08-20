"use client";

import { cn } from "@/lib/utils";
import type { EvidenceConfidence, ExceptionKind, ExceptionSeverity } from "@/lib/cvos/types";

const KIND_LABEL: Record<ExceptionKind, string> = {
  needs_attention: "Needs Attention",
  decision_required: "Decision Required",
  at_risk: "At Risk",
  off_track: "Off Track",
  cash_risk: "Cash Risk",
  kpi_deterioration: "KPI Deterioration",
  data_missing: "Data Missing",
  forecast_variance: "Forecast Variance",
  opportunity: "Opportunity",
  ready: "Ready",
  outcome: "Outcome",
};

export function ConfidenceBadge({ confidence }: { confidence: EvidenceConfidence }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        confidence === "VERIFIED" && "bg-emerald-950/10 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
        confidence === "ESTIMATED" && "bg-amber-950/10 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
        confidence === "INFERRED" && "bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300",
      )}
    >
      {confidence}
    </span>
  );
}

export function ExceptionBadge({ kind }: { kind: ExceptionKind }) {
  const tone =
    kind === "decision_required" || kind === "cash_risk" || kind === "at_risk"
      ? "border-rose-300/60 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
      : kind === "kpi_deterioration" || kind === "off_track" || kind === "needs_attention"
        ? "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        : kind === "opportunity" || kind === "ready" || kind === "outcome"
          ? "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "border-border bg-muted text-muted-foreground";

  return (
    <span className={cn("inline-flex rounded border px-2 py-0.5 text-[11px] font-medium", tone)}>
      {KIND_LABEL[kind]}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: ExceptionSeverity }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        severity === "critical" && "bg-rose-600",
        severity === "high" && "bg-rose-500",
        severity === "medium" && "bg-amber-500",
        severity === "low" && "bg-slate-400",
        severity === "info" && "bg-sky-500",
      )}
      aria-label={severity}
    />
  );
}

export function CvosSection({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("cvos-section", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-cvos text-lg tracking-tight text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "watch" | "risk";
}) {
  return (
    <div
      className={cn(
        "cvos-tile border-l-2 px-4 py-3",
        tone === "good" && "border-l-emerald-600",
        tone === "watch" && "border-l-amber-500",
        tone === "risk" && "border-l-rose-600",
        tone === "neutral" && "border-l-slate-400",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-cvos text-2xl tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
