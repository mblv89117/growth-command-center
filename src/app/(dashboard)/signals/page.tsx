"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTenant } from "@/lib/tenant/context";
import type { AtlasOutboundSignal, CapitalSignal } from "@/lib/cvos/types";
import { ConfidenceBadge, CvosSection, SeverityDot } from "@/components/cvos/primitives";
import { formatCurrency } from "@/lib/utils";

interface SignalsResponse {
  atlasCommercialAuthority: boolean;
  lenderOutreachStarted: boolean;
  signals: AtlasOutboundSignal[];
  capital: CapitalSignal[];
}

export default function SignalsPage() {
  const { organization } = useTenant();
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cvos/signals?organizationId=${encodeURIComponent(organization.id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        return res.json() as Promise<SignalsResponse>;
      })
      .then(setData)
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

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
        <h1 className="font-semibold">Signals unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="cvos-shell space-y-8">
      <header className="border-b pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Renewal · Expansion · Capital
        </p>
        <h1 className="font-cvos mt-2 text-3xl tracking-tight">Atlas Signals</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Structured signals for Atlas commercial authority. Capital signals never start lender outreach.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded border px-2 py-1">
            Atlas commercial authority: {data.atlasCommercialAuthority ? "yes" : "no"}
          </span>
          <span className="rounded border px-2 py-1">
            Lender outreach started: {data.lenderOutreachStarted ? "yes" : "no"}
          </span>
        </div>
      </header>

      <CvosSection title="Capital Need" subtitle="Governed signal only — Atlas Capital Operations decides">
        <ul className="space-y-3">
          {data.capital.map((c) => (
            <li key={c.signalId} className="cvos-tile space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <ConfidenceBadge confidence={c.confidence} />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.status}</span>
                <span className="text-xs text-muted-foreground">{c.contractVersion}</span>
              </div>
              <p>{c.rationale}</p>
              <p className="text-xs text-muted-foreground">
                Estimated need:{" "}
                {c.estimatedNeed != null ? formatCurrency(c.estimatedNeed) : "n/a"} · Lender outreach
                allowed: {String(c.lenderOutreachAllowed)}
              </p>
            </li>
          ))}
        </ul>
      </CvosSection>

      <CvosSection title="Outbound Signals" subtitle="gcc-atlas-signal.v1">
        <ul className="space-y-3">
          {data.signals.map((s) => (
            <li key={s.signalId} className="cvos-tile flex gap-3 p-4 text-sm">
              <SeverityDot severity={s.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium capitalize">{s.kind.replace(/_/g, " ")}</span>
                  {s.requiresAtlasAction ? (
                    <span className="rounded border border-amber-400/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-200">
                      Atlas action
                    </span>
                  ) : null}
                  {s.capitalOpsEligible ? (
                    <span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Capital Ops eligible
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground">{s.summary}</p>
              </div>
            </li>
          ))}
        </ul>
      </CvosSection>
    </div>
  );
}
