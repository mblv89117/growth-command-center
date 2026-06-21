"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestKpiStatus } from "@/lib/kpi/status";
import type { KPI, KpiStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, X } from "lucide-react";

interface KpiEditModalProps {
  kpi: KPI;
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (kpi: KPI) => void;
}

const STATUS_OPTIONS: { value: KpiStatus; label: string }[] = [
  { value: "green", label: "Green — on track" },
  { value: "yellow", label: "Yellow — watch" },
  { value: "red", label: "Red — at risk" },
];

export function KpiEditModal({
  kpi,
  organizationId,
  open,
  onClose,
  onSaved,
}: KpiEditModalProps) {
  const [name, setName] = useState(kpi.name);
  const [value, setValue] = useState(String(kpi.value));
  const [target, setTarget] = useState(kpi.target != null ? String(kpi.target) : "");
  const [status, setStatus] = useState<KpiStatus>(kpi.status ?? "green");
  const [plan, setPlan] = useState(kpi.plan ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const suggestedStatus = suggestKpiStatus({
    ...kpi,
    value: Number(value) || 0,
    target: target ? Number(target) : undefined,
  });

  useEffect(() => {
    if (!open) return;
    setName(kpi.name);
    setValue(String(kpi.value));
    setTarget(kpi.target != null ? String(kpi.target) : "");
    setStatus(kpi.status ?? suggestedStatus ?? "green");
    setPlan(kpi.plan ?? "");
    setError(null);
    setSuccess(false);
  }, [open, kpi, suggestedStatus]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const parsedValue = Number(value);
    const parsedTarget = target.trim() ? Number(target) : null;

    if (Number.isNaN(parsedValue)) {
      setError("Value must be a valid number.");
      setSaving(false);
      return;
    }
    if (target.trim() && Number.isNaN(Number(target))) {
      setError("Target must be a valid number.");
      setSaving(false);
      return;
    }
    if (status === "yellow" && !plan.trim()) {
      setError("Plan is required when status is yellow.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/kpis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          kpiKey: kpi.id,
          name: name.trim(),
          value: parsedValue,
          target: parsedTarget,
          status,
          plan: plan.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update KPI");
        return;
      }

      setSuccess(true);
      onSaved(data.kpi as KPI);
      setTimeout(() => onClose(), 800);
    } catch {
      setError("Unable to save KPI. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg border-primary/20 shadow-xl">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Edit KPI</CardTitle>
            <CardDescription>Update value, target, status, and action plan</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              KPI saved
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="kpi-name">Label</Label>
            <Input id="kpi-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kpi-value">Value</Label>
              <Input
                id="kpi-value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-target">Target</Label>
              <Input
                id="kpi-target"
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kpi-status">Status</Label>
            <select
              id="kpi-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as KpiStatus)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {suggestedStatus && suggestedStatus !== status && (
              <p className="text-xs text-muted-foreground">
                Suggested from value vs target:{" "}
                <span className="font-medium capitalize">{suggestedStatus}</span> (manual override
                kept)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="kpi-plan">
              Plan {status === "yellow" && <span className="text-destructive">*</span>}
            </Label>
            <textarea
              id="kpi-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              rows={3}
              placeholder={
                status === "yellow"
                  ? "Describe the corrective plan for this KPI"
                  : "Optional action plan or notes"
              }
              className={cn(
                "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                status === "yellow" && !plan.trim() && "border-warning/50"
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save KPI
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
