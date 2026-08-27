"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PlatformTenantDirectory } from "@/lib/admin/platform-tenants";
import { Loader2 } from "lucide-react";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "hvcg_included") return "default";
  if (status === "trialing" || status === "trial") return "secondary";
  if (status === "past_due" || status === "canceled" || status === "inactive") return "destructive";
  return "outline";
}

export function AdminDashboard({ directory }: { directory: PlatformTenantDirectory }) {
  const [rows, setRows] = useState(directory.tenants);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const counts = useMemo(() => {
    const next = {
      total: rows.length,
      trialing: rows.filter((t) => t.subscriptionStatus === "trialing" || t.accessType === "trial").length,
      activePaid: rows.filter((t) => t.subscriptionStatus === "active" && t.accessType === "standalone").length,
      pastDue: rows.filter((t) => t.subscriptionStatus === "past_due").length,
      canceled: rows.filter((t) => t.subscriptionStatus === "canceled").length,
      hvcgIncluded: rows.filter((t) => t.hvcgIncluded).length,
      onboardingIncomplete: rows.filter((t) => !t.onboardingComplete).length,
    };
    return next;
  }, [rows]);

  const totalMrr = rows.reduce((sum, tenant) => sum + tenant.estimatedMrr, 0);

  const setHvcgIncluded = async (organizationId: string) => {
    setUpdatingId(organizationId);
    try {
      const res = await fetch(`/api/admin/tenants/${organizationId}/entitlement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessType: "hvcg_included", hvcgEngagementActive: true }),
      });
      if (!res.ok) return;
      setRows((current) =>
        current.map((tenant) =>
          tenant.organizationId === organizationId
            ? {
                ...tenant,
                accessType: "hvcg_included",
                hvcgIncluded: true,
                billingStatus: "hvcg_included",
                estimatedMrr: 0,
              }
            : tenant
        )
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        description="HVCG owner view of all GCC tenants, billing status, and onboarding health"
      />

      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-primary">HVCG Internal Owner Console</p>
        <p className="text-sm text-muted-foreground">
          Restricted to platform administrators. Live tenant and billing data — no payment card details are shown.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Estimated MRR" value={totalMrr} />
        <MetricCard title="Total Tenants" value={counts.total} format="number" />
        <MetricCard title="Active Paid" value={counts.activePaid} format="number" />
        <MetricCard title="HVCG Included" value={counts.hvcgIncluded} format="number" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Trialing" value={counts.trialing} format="number" variant="warning" />
        <MetricCard title="Past Due" value={counts.pastDue} format="number" variant="warning" />
        <MetricCard title="Canceled" value={counts.canceled} format="number" />
        <MetricCard title="Onboarding Incomplete" value={counts.onboardingIncomplete} format="number" variant="warning" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>All GCC Customers</CardTitle>
          <CardDescription>Organizations registered on Growth Command Center</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Company</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Primary User</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Entitlement</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Billing</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Onboarding</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Stripe</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Created</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tenant) => (
                  <tr key={tenant.organizationId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <div className="font-medium">{tenant.companyName}</div>
                      <div className="text-xs text-muted-foreground">{tenant.organizationId}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{tenant.primaryUserName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{tenant.primaryEmail ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={tenant.hvcgIncluded ? "default" : "secondary"}>
                        {tenant.accessType}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(tenant.billingStatus)}>{tenant.billingStatus}</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {tenant.nextBillingDate ? `Next: ${formatDate(tenant.nextBillingDate)}` : "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={tenant.onboardingComplete ? "default" : "secondary"}>
                        {tenant.onboardingComplete ? "Complete" : tenant.onboardingStep ?? "Incomplete"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div>{tenant.dataSource ?? "empty"}</div>
                      <div className="text-xs text-muted-foreground">
                        {tenant.connectedSystemsCount} connected
                        {tenant.lastSuccessfulImport
                          ? ` · sync ${formatDate(tenant.lastSuccessfulImport)}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <div>{tenant.stripeCustomerId ? `cus: ${tenant.stripeCustomerId.slice(0, 14)}…` : "—"}</div>
                      <div>
                        {tenant.stripeSubscriptionId
                          ? `sub: ${tenant.stripeSubscriptionId.slice(0, 14)}…`
                          : "—"}
                      </div>
                      <div className="mt-1">{formatCurrency(tenant.estimatedMrr)}/mo</div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      <div>{tenant.createdAt ? formatDate(tenant.createdAt) : "—"}</div>
                      <div className="text-xs">
                        Trial ends {tenant.trialEnd ? formatDate(tenant.trialEnd) : "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {!tenant.hvcgIncluded ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === tenant.organizationId}
                          onClick={() => setHvcgIncluded(tenant.organizationId)}
                        >
                          {updatingId === tenant.organizationId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Mark HVCG Included"
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Included</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
