"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { useTenant } from "@/lib/tenant/context";
import type { ExecutiveCockpitPayload } from "@/lib/cvos/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge, CvosSection, ExceptionBadge, MetricTile, SeverityDot } from "./primitives";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatKpi(value: number, unit: string): string {
  if (unit === "currency") return formatCurrency(value, true);
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "days") return `${value}d`;
  return String(value);
}

export function ExecutiveCockpitView() {
  const { organization } = useTenant();
  const [data, setData] = useState<ExecutiveCockpitPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/cvos/cockpit?organizationId=${encodeURIComponent(organization.id)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ExecutiveCockpitPayload>;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [organization.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading executive cockpit</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
        <h2 className="font-semibold">Cockpit unavailable</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error === "cvos_unavailable"
            ? "Client Value OS synthetic data is not mapped for this tenant."
            : error ?? "Unable to load cockpit."}
        </p>
      </div>
    );
  }

  const { financials, narrative, clientContext } = data;

  return (
    <div className="cvos-shell space-y-8">
      <header className="cvos-hero relative overflow-hidden rounded-none border-b border-border/80 pb-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(15,23,42,0.06),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_left,_rgba(148,163,184,0.08),_transparent_55%)]" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            High Value Capital Group · Client Value OS
          </p>
          <h1 className="font-cvos mt-2 text-3xl tracking-tight md:text-4xl">{clientContext.displayName}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
            {clientContext.offer} · {clientContext.serviceFamily} · Renewal {clientContext.renewalDate}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded border px-2 py-1">{clientContext.clientCode}</span>
            <span className="rounded border px-2 py-1">{clientContext.engagementId}</span>
            <span className="rounded border px-2 py-1">Synthetic · {data.source}</span>
            <span className="rounded border px-2 py-1">Brief: {data.briefStatus.replace("_", " ")}</span>
          </div>
        </div>
      </header>

      <CvosSection title="Executive Summary" subtitle="Where the business is — and what requires a decision">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              <span className="font-medium text-foreground">Now: </span>
              {narrative.whereNow}
            </p>
            <p>
              <span className="font-medium text-foreground">Changed: </span>
              {narrative.whatChanged}
            </p>
            <p>
              <span className="font-medium text-foreground">Value created: </span>
              {narrative.valueCreated}
            </p>
            <p className="border-l-2 border-slate-800 pl-3 dark:border-slate-200">
              <span className="font-medium">Next: </span>
              {narrative.nextAction}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="cvos-tile p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Improving</p>
              <ul className="mt-2 space-y-1 text-sm">
                {narrative.improving.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
            <div className="cvos-tile p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deteriorating</p>
              <ul className="mt-2 space-y-1 text-sm">
                {narrative.deteriorating.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
            <div className="cvos-tile p-3 sm:col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">HVCG working on</p>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {narrative.hvcgWorkingOn.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CvosSection>

      <CvosSection title="Financial Position" subtitle="Cash, earnings, and working capital">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Cash Position"
            value={formatCurrency(financials.cashPosition)}
            hint={`Floor ${formatCurrency(clientContext.targets.cashFloor ?? 0)}`}
            tone="good"
          />
          <MetricTile
            label="13-Week Forecast"
            value={formatCurrency(financials.forecastedCash13wk)}
            hint={`${financials.cashRiskWeeks} risk weeks`}
            tone={financials.cashRiskWeeks > 0 ? "watch" : "neutral"}
          />
          <MetricTile label="Revenue MTD" value={formatCurrency(financials.revenueMTD)} />
          <MetricTile
            label="Gross Margin"
            value={formatPercent(financials.grossMarginPct).replace("+", "")}
            tone="watch"
          />
          <MetricTile label="EBITDA" value={formatCurrency(financials.ebitda, true)} hint="ESTIMATED run-rate" />
          <MetricTile label="AR" value={formatCurrency(financials.ar, true)} />
          <MetricTile label="AP" value={formatCurrency(financials.ap, true)} />
          <MetricTile label="Runway" value={`${financials.runwayMonths.toFixed(1)} mo`} />
        </div>
      </CvosSection>

      <CvosSection title="13-Week Cash View" subtitle="Risk weeks highlighted">
        <div className="h-56 w-full" role="img" aria-label="Thirteen week cash forecast chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.cashWeeks}>
              <defs>
                <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(215 25% 27%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(215 25% 27%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} fontSize={11} />
              <YAxis
                fontSize={11}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(w) => `Week ${w}`}
              />
              <Area
                type="monotone"
                dataKey="endingBalance"
                stroke="hsl(215 28% 25%)"
                fill="url(#cashFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CvosSection>

      <div className="grid gap-8 lg:grid-cols-2">
        <CvosSection title="Needs Attention" subtitle="Exception-driven queue">
          <ul className="space-y-3">
            {data.exceptions.map((ex) => (
              <li key={ex.id} className="cvos-tile flex gap-3 p-3">
                <SeverityDot severity={ex.severity} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ExceptionBadge kind={ex.kind} />
                    <ConfidenceBadge confidence={ex.confidence} />
                  </div>
                  <p className="font-medium">{ex.title}</p>
                  <p className="text-sm text-muted-foreground">{ex.summary}</p>
                  {ex.decisionNeeded ? (
                    <p className="text-sm">
                      <span className="font-medium">Decision: </span>
                      {ex.decisionNeeded}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CvosSection>

        <CvosSection
          title="KPIs"
          subtitle="Approved engagement KPIs"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/value-creation">
                Value creation <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <caption className="sr-only">Approved KPI scorecard</caption>
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-2 font-medium">
                    KPI
                  </th>
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Current
                  </th>
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Target
                  </th>
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Trend
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Evidence
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.kpis.map((kpi) => (
                  <tr key={kpi.key} className="border-b border-border/60">
                    <th scope="row" className="py-2.5 pr-2 font-medium">
                      {kpi.label}
                    </th>
                    <td className="py-2.5 pr-2 tabular-nums">{formatKpi(kpi.current, kpi.unit)}</td>
                    <td className="py-2.5 pr-2 tabular-nums text-muted-foreground">
                      {formatKpi(kpi.target, kpi.unit)}
                    </td>
                    <td className="py-2.5 pr-2 capitalize">{kpi.trend}</td>
                    <td className="py-2.5">
                      <ConfidenceBadge confidence={kpi.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CvosSection>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <CvosSection title="90-Day Priorities">
          <ol className="space-y-2 text-sm">
            {data.priorities.map((p) => (
              <li key={p.id} className="cvos-tile flex gap-3 p-3">
                <span className="font-cvos text-lg text-muted-foreground">{p.rank}</span>
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.owner} · {p.status.replace("_", " ")} · due {p.dueDate}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CvosSection>

        <CvosSection title="Decisions Required">
          <ul className="space-y-3">
            {data.decisions.map((d) => (
              <li key={d.id} className="cvos-tile space-y-2 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <SeverityDot severity={d.urgency} />
                  <p className="font-medium">{d.title}</p>
                </div>
                <p className="text-muted-foreground">{d.context}</p>
                <ul className="text-xs text-muted-foreground">
                  {d.options.map((o) => (
                    <li key={o}>· {o}</li>
                  ))}
                </ul>
                <p className="text-xs">
                  Owner {d.owner} · due {d.dueDate}
                </p>
              </li>
            ))}
          </ul>
        </CvosSection>

        <CvosSection title="Risks">
          <ul className="space-y-3">
            {data.risks.map((r) => (
              <li key={r.id} className="cvos-tile space-y-1 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <SeverityDot severity={r.severity} />
                  <p className="font-medium">{r.title}</p>
                </div>
                <p className="text-muted-foreground">{r.description}</p>
                <p className="text-xs">Mitigation: {r.mitigation}</p>
              </li>
            ))}
          </ul>
        </CvosSection>
      </div>

      <CvosSection
        title="Value Creation"
        subtitle="VERIFIED impact only counted as financial improvement"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/executive-brief">Monthly brief</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/signals">Signals</Link>
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Value creation initiatives</caption>
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-2 font-medium">
                  Initiative
                </th>
                <th scope="col" className="py-2 pr-2 font-medium">
                  Baseline → Current → Target
                </th>
                <th scope="col" className="py-2 pr-2 font-medium">
                  Impact
                </th>
                <th scope="col" className="py-2 pr-2 font-medium">
                  Status
                </th>
                <th scope="col" className="py-2 font-medium">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody>
              {data.valueInitiatives.map((v) => (
                <tr key={v.id} className="border-b border-border/60 align-top">
                  <th scope="row" className="py-3 pr-2 font-medium">
                    <div>{v.initiative}</div>
                    <div className="mt-1 text-xs font-normal text-muted-foreground">{v.evidence}</div>
                  </th>
                  <td className="py-3 pr-2 tabular-nums text-muted-foreground">
                    {v.baseline} → {v.current} → {v.target} {v.unit}
                  </td>
                  <td className="py-3 pr-2 tabular-nums">
                    {v.confidence === "VERIFIED" && v.financialImpact > 0
                      ? formatCurrency(v.financialImpact)
                      : v.confidence === "INFERRED"
                        ? "—"
                        : v.financialImpact > 0
                          ? `~${formatCurrency(v.financialImpact)}`
                          : "—"}
                  </td>
                  <td className="py-3 pr-2 capitalize">{v.status.replace("_", " ")}</td>
                  <td className="py-3">
                    <ConfidenceBadge confidence={v.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CvosSection>
    </div>
  );
}
