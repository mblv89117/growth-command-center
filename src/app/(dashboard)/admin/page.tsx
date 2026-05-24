"use client";

import { PageHeader } from "@/components/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_TENANTS } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AdminPage() {
  const totalMRR = PLATFORM_TENANTS.reduce((s, t) => s + t.mrr, 0);
  const activeTenants = PLATFORM_TENANTS.filter((t) => t.status === "active").length;
  const totalUsers = PLATFORM_TENANTS.reduce((s, t) => s + t.users, 0);
  const trialTenants = PLATFORM_TENANTS.filter((t) => t.status === "trial").length;

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        description="Platform owner view of tenants, users, subscriptions, and usage"
      />

      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-primary">Platform Owner Dashboard</p>
        <p className="text-sm text-muted-foreground">
          This view is restricted to platform administrators. Tenant data is isolated and secure.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total MRR" value={totalMRR} />
        <MetricCard title="Active Tenants" value={activeTenants} format="number" />
        <MetricCard title="Total Users" value={totalUsers} format="number" />
        <MetricCard title="Trial Accounts" value={trialTenants} format="number" variant="warning" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>Organizations registered on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Organization</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Users</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">MRR</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_TENANTS.map((tenant) => (
                  <tr key={tenant.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{tenant.name}</td>
                    <td className="px-4 py-3">{tenant.plan}</td>
                    <td className="px-4 py-3 text-right">{tenant.users}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(tenant.mrr)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          tenant.status === "active"
                            ? "success"
                            : tenant.status === "trial"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {tenant.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(tenant.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {["Enterprise", "Growth", "Starter"].map((plan) => {
                const count = PLATFORM_TENANTS.filter((t) => t.plan === plan).length;
                return (
                  <div key={plan} className="flex items-center justify-between">
                    <span>{plan}</span>
                    <Badge variant="secondary">{count} tenants</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Platform Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime (30d)</span>
                <span className="font-medium text-success">99.98%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg API Response</span>
                <span className="font-medium">124ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Integrations</span>
                <span className="font-medium">847</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Churn Rate (30d)</span>
                <span className="font-medium">1.2%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
