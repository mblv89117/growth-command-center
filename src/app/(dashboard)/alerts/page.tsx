"use client";

import { useState } from "react";
import { AlertItem, PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantData } from "@/hooks/use-tenant-data";
import type { AlertSeverity } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function AlertsPage() {
  const { data, loading } = useTenantData();
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");

  const alerts = data.alerts.filter((a) => filter === "all" || a.severity === filter);
  const unreadCount = data.alerts.filter((a) => !a.isRead).length;
  const criticalCount = data.alerts.filter((a) => a.severity === "critical").length;

  const severityCounts = {
    critical: data.alerts.filter((a) => a.severity === "critical").length,
    high: data.alerts.filter((a) => a.severity === "high").length,
    medium: data.alerts.filter((a) => a.severity === "medium").length,
    low: data.alerts.filter((a) => a.severity === "low").length,
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Alerts & Decision Support"
        description="Financial and operational risk alerts with recommended actions"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{severityCounts.high}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.alerts.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" onClick={() => setFilter("all")}>
            All ({data.alerts.length})
          </TabsTrigger>
          <TabsTrigger value="critical" onClick={() => setFilter("critical")}>
            Critical ({severityCounts.critical})
          </TabsTrigger>
          <TabsTrigger value="high" onClick={() => setFilter("high")}>
            High ({severityCounts.high})
          </TabsTrigger>
          <TabsTrigger value="medium" onClick={() => setFilter("medium")}>
            Medium ({severityCounts.medium})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-4">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} {...alert} />
          ))}
        </TabsContent>
        <TabsContent value="critical" className="mt-6 space-y-4">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} {...alert} />
          ))}
        </TabsContent>
        <TabsContent value="high" className="mt-6 space-y-4">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} {...alert} />
          ))}
        </TabsContent>
        <TabsContent value="medium" className="mt-6 space-y-4">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} {...alert} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
