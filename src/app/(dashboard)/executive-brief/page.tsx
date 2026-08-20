"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTenant } from "@/lib/tenant/context";
import type { ExecutiveBrief } from "@/lib/cvos/types";
import { Button } from "@/components/ui/button";
import { CvosSection } from "@/components/cvos/primitives";

export default function ExecutiveBriefPage() {
  const { organization, user } = useTenant();
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [deliveryAllowed, setDeliveryAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/cvos/executive-brief?organizationId=${encodeURIComponent(organization.id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        return res.json() as Promise<{ brief: ExecutiveBrief; externalDeliveryAllowed: boolean }>;
      })
      .then((json) => {
        setBrief(json.brief);
        setDeliveryAllowed(json.externalDeliveryAllowed);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization.id]);

  async function approve() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cvos/executive-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          action: "approve",
          approvedBy: user.email || user.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setBrief(json.brief);
      setDeliveryAllowed(json.externalDeliveryAllowed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "approve_failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
        <h1 className="font-semibold">Brief unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const sections: { title: string; items: string[] }[] = [
    { title: "Financial Highlights", items: brief.financialHighlights },
    { title: "Value Creation Progress", items: brief.valueCreationProgress },
    { title: "Major Wins", items: brief.majorWins },
    { title: "Risks", items: brief.risks },
    { title: "Decisions Required", items: brief.decisionsRequired },
    { title: "90-Day Priorities", items: brief.ninetyDayPriorities },
    { title: "HVCG Actions", items: brief.hvcgActions },
    { title: "Client Actions", items: brief.clientActions },
  ];

  return (
    <div className="cvos-shell space-y-8">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Monthly Executive Brief
          </p>
          <h1 className="font-cvos mt-2 text-3xl tracking-tight">{brief.periodLabel}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Status: {brief.status.replace("_", " ")} · Drafted by {brief.draftedBy}
            {brief.approvedBy ? ` · Approved by ${brief.approvedBy}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brief.status === "pending_approval" || brief.status === "draft" ? (
            <Button onClick={approve} disabled={saving}>
              {saving ? "Approving…" : "Approve for external delivery"}
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            External delivery {deliveryAllowed ? "allowed" : "blocked until approval"}
          </span>
        </div>
      </header>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <CvosSection title="Executive Summary">
        <p className="max-w-3xl text-sm leading-relaxed">{brief.executiveSummary}</p>
        <p className="mt-3 text-xs text-muted-foreground">{brief.confidenceNotes}</p>
      </CvosSection>

      <CvosSection title="KPI Movement">
        <table className="w-full max-w-xl text-left text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-medium">KPI</th>
              <th className="py-2 font-medium">Prior</th>
              <th className="py-2 font-medium">Current</th>
              <th className="py-2 font-medium">Direction</th>
            </tr>
          </thead>
          <tbody>
            {brief.kpiMovement.map((k) => (
              <tr key={k.kpi} className="border-b border-border/60">
                <th scope="row" className="py-2 font-medium">
                  {k.kpi}
                </th>
                <td className="py-2 tabular-nums">
                  {k.prior} {k.unit === "currency" ? "" : k.unit === "percent" ? "%" : k.unit}
                </td>
                <td className="py-2 tabular-nums">{k.current}</td>
                <td className="py-2 capitalize">{k.direction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CvosSection>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((s) => (
          <CvosSection key={s.title} title={s.title}>
            <ul className="space-y-1 text-sm">
              {s.items.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </CvosSection>
        ))}
      </div>
    </div>
  );
}
