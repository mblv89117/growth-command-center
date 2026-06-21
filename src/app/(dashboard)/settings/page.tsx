"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant/context";
import { formatCurrency } from "@/lib/utils";
import { STRIPE_PLANS, type PlanKey } from "@/lib/stripe/config";
import { Loader2 } from "lucide-react";

async function saveSettings(
  organizationId: string,
  section: string,
  settings: Record<string, unknown>
): Promise<{ message: string; preview?: boolean; success?: boolean }> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, section, settings }),
  });
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    throw new Error(data.error ?? "Failed to save settings");
  }
  return data;
}

export default function SettingsPage() {
  const { organization } = useTenant();
  const { settings } = organization;
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "organization";
  const [billingLoading, setBillingLoading] = useState<PlanKey | "portal" | null>(null);
  const [saveLoading, setSaveLoading] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<{
    message: string;
    variant: "success" | "preview" | "error";
  } | null>(null);
  const currentPlan = STRIPE_PLANS[organization.plan as PlanKey] ?? STRIPE_PLANS.growth;
  const [billingNotice, setBillingNotice] = useState<string | null>(() => {
    if (searchParams.get("success")) return "Subscription updated successfully.";
    if (searchParams.get("cancelled")) return "Checkout was cancelled.";
    return null;
  });

  const handleSave = async (section: string, settingsPayload: Record<string, unknown>) => {
    setSaveLoading(section);
    setSaveNotice(null);
    try {
      const result = await saveSettings(organization.id, section, settingsPayload);
      setSaveNotice({
        message: result.message,
        variant: result.preview ? "preview" : result.success ? "success" : "error",
      });
    } catch (error) {
      setSaveNotice({
        message: error instanceof Error ? error.message : "Failed to save settings",
        variant: "error",
      });
    } finally {
      setSaveLoading(null);
    }
  };

  const startCheckout = async (plan: PlanKey) => {
    setBillingLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setBillingNotice(data.error ?? "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local.");
    } finally {
      setBillingLoading(null);
    }
  };

  const openPortal = async () => {
    setBillingLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setBillingNotice(data.error ?? "No active subscription found.");
    } finally {
      setBillingLoading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organization settings, forecast assumptions, thresholds, and billing"
      />

      {saveNotice && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            saveNotice.variant === "success"
              ? "border-success/30 bg-success/10"
              : saveNotice.variant === "preview"
                ? "border-warning/30 bg-warning/10"
                : "border-destructive/30 bg-destructive/10"
          }`}
        >
          {saveNotice.message}
        </div>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="alerts">Alert Thresholds</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>Basic information about your company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" defaultValue={organization.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" defaultValue={organization.industry} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Workspace URL</Label>
                  <Input id="slug" defaultValue={organization.slug} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" defaultValue={settings.currency} />
                </div>
              </div>
              <Button
                disabled={saveLoading === "organization"}
                onClick={() =>
                  handleSave("organization", {
                    name: (document.getElementById("org-name") as HTMLInputElement)?.value,
                    industry: (document.getElementById("industry") as HTMLInputElement)?.value,
                    slug: (document.getElementById("slug") as HTMLInputElement)?.value,
                    currency: (document.getElementById("currency") as HTMLInputElement)?.value,
                  })
                }
              >
                {saveLoading === "organization" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Settings</CardTitle>
              <CardDescription>Default assumptions for cash forecasting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="horizon">Forecast Horizon (weeks)</Label>
                  <Input id="horizon" type="number" defaultValue={settings.forecastHorizonWeeks} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscal">Fiscal Year Start (month)</Label>
                  <Input id="fiscal" type="number" defaultValue={settings.fiscalYearStart} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Include sales pipeline in forecast</p>
                  <p className="text-sm text-muted-foreground">Weight open deals into revenue projections</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Include job billing schedule</p>
                  <p className="text-sm text-muted-foreground">Project cash from active job milestones</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button
                disabled={saveLoading === "forecast"}
                onClick={() =>
                  handleSave("forecast", {
                    forecastHorizonWeeks: Number(
                      (document.getElementById("horizon") as HTMLInputElement)?.value
                    ),
                    fiscalYearStart: Number(
                      (document.getElementById("fiscal") as HTMLInputElement)?.value
                    ),
                  })
                }
              >
                {saveLoading === "forecast" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Forecast Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Thresholds</CardTitle>
              <CardDescription>Configure when financial alerts are triggered</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cash-threshold">Minimum Cash Balance Alert</Label>
                <Input
                  id="cash-threshold"
                  type="number"
                  defaultValue={settings.cashAlertThreshold}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {formatCurrency(settings.cashAlertThreshold)}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">AR aging alerts</p>
                  <p className="text-sm text-muted-foreground">Alert when invoices exceed 30 days</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Margin variance alerts</p>
                  <p className="text-sm text-muted-foreground">Alert when job margin drops 5%+ below estimate</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button
                disabled={saveLoading === "alerts"}
                onClick={() =>
                  handleSave("alerts", {
                    cashAlertThreshold: Number(
                      (document.getElementById("cash-threshold") as HTMLInputElement)?.value
                    ),
                  })
                }
              >
                {saveLoading === "alerts" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Alert Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription & Billing</CardTitle>
              <CardDescription>Manage your Growth Command Center plan via Stripe</CardDescription>
            </CardHeader>
            <CardContent>
              {billingNotice && (
                <div className="mb-4 rounded-lg border bg-muted/50 p-3 text-sm">{billingNotice}</div>
              )}

              <div className="mb-6 flex items-center justify-between rounded-xl border bg-primary/5 p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold capitalize">{organization.plan} Plan</h3>
                    <Badge>Active</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    ${currentPlan.price / 100}/month
                    · Up to {currentPlan.users} users
                  </p>
                </div>
                <Button variant="outline" onClick={openPortal} disabled={billingLoading === "portal"}>
                  {billingLoading === "portal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Manage Billing
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {(Object.entries(STRIPE_PLANS) as [PlanKey, typeof STRIPE_PLANS.starter][]).map(
                  ([key, plan]) => (
                    <div
                      key={key}
                      className={`rounded-xl border p-4 ${organization.plan === key ? "border-primary bg-primary/5" : ""}`}
                    >
                      <h4 className="font-semibold">{plan.name}</h4>
                      <p className="mt-1 text-2xl font-bold">${plan.price / 100}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {plan.features.map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                      <Button
                        className="mt-4 w-full"
                        variant={organization.plan === key ? "outline" : "default"}
                        disabled={organization.plan === key || billingLoading === key}
                        onClick={() => startCheckout(key)}
                      >
                        {billingLoading === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {organization.plan === key ? "Current Plan" : `Upgrade to ${plan.name}`}
                      </Button>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
