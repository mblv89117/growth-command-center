"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTenant } from "@/lib/tenant/context";
import type { ValueCreationBoard } from "@/lib/cvos/value-creation";
import { formatCurrency } from "@/lib/utils";
import { ConfidenceBadge, CvosSection, MetricTile } from "@/components/cvos/primitives";

export default function ValueCreationPage() {
  const { organization } = useTenant();
  const [board, setBoard] = useState<ValueCreationBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cvos/value-creation?organizationId=${encodeURIComponent(organization.id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        return res.json() as Promise<ValueCreationBoard>;
      })
      .then(setBoard)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [organization.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
        <h1 className="font-semibold">Value creation unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="cvos-shell space-y-8">
      <header className="border-b pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          HVCG Client Value Story
        </p>
        <h1 className="font-cvos mt-2 text-3xl tracking-tight">Value Creation</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Track initiatives with baseline, target, evidence, and confidence. Financial improvement is never fabricated.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          label="Verified financial impact"
          value={formatCurrency(board.verifiedFinancialImpact)}
          tone="good"
          hint="VERIFIED only"
        />
        <MetricTile
          label="Estimated impact"
          value={formatCurrency(board.estimatedFinancialImpact)}
          tone="watch"
          hint="Not counted as verified"
        />
        <MetricTile
          label="Inferred initiatives"
          value={String(board.inferredCount)}
          hint="Operational only — $0 claimed"
        />
      </div>

      <CvosSection title="What has HVCG done?" subtitle="Renewal and case-study evidence">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="cvos-tile space-y-2 p-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Actions</p>
            <ul className="space-y-1">
              {board.story.whatHvcgDone.map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
          <div className="cvos-tile space-y-2 p-4 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">What changed</p>
            <ul className="space-y-1">
              {board.story.whatChanged.map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
          <div className="cvos-tile space-y-2 p-4 text-sm md:col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Evidenced value</p>
            <p>{board.story.evidencedValue}</p>
            <p className="mt-3 border-l-2 border-slate-800 pl-3 dark:border-slate-200">
              <span className="font-medium">Next highest-value action: </span>
              {board.story.nextHighestValueAction}
            </p>
          </div>
        </div>
      </CvosSection>

      <CvosSection title="Initiatives">
        <ul className="space-y-3">
          {board.initiatives.map((i) => (
            <li key={i.id} className="cvos-tile p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{i.initiative}</h3>
                <ConfidenceBadge confidence={i.confidence} />
                <span className="text-xs capitalize text-muted-foreground">{i.status.replace("_", " ")}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{i.evidence}</p>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <span>
                  Baseline → Current → Target: {i.baseline} → {i.current} → {i.target} {i.unit}
                </span>
                <span>Owner: {i.owner}</span>
                <span>Timeframe: {i.timeframe}</span>
                <span>Ops: {i.operationalImpact}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 cvos-tile p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">What remains</p>
          <ul className="mt-2 space-y-1">
            {board.story.remains.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </div>
      </CvosSection>
    </div>
  );
}
