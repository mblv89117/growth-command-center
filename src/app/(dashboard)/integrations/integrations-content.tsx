"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant/context";
import type { Integration, IntegrationStatus } from "@/lib/types";
import { Loader2, RefreshCw } from "lucide-react";

const categoryLabels: Record<string, string> = {
  accounting: "Accounting",
  payments: "Payments & Banking",
  payroll: "Payroll",
  operations: "Operations",
  sales: "Sales & CRM",
  other: "Other",
};

interface LiveIntegration extends Integration {
  isLive?: boolean;
  metadata?: Record<string, string | number>;
  connectedAt?: string;
  errorMessage?: string;
}

export default function IntegrationsContent() {
  const { organization } = useTenant();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<LiveIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    const res = await fetch(`/api/integrations?organizationId=${organization.id}`);
    const data = await res.json();
    setIntegrations(data.integrations ?? []);
    setLoading(false);
  }, [organization.id]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "quickbooks") {
      setNotice("QuickBooks connected successfully!");
    }
    if (connected === "plaid") {
      setNotice("Plaid connected successfully!");
    }
    if (error) {
      setNotice(`Integration error: ${error}`);
    }
  }, [searchParams]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id }),
      });
      const data = await res.json();
      setNotice(data.results?.[0]?.message ?? "Sync complete");
      await fetchIntegrations();
    } finally {
      setSyncing(false);
    }
  };

  const categories = [...new Set(integrations.map((i) => i.category))];
  const connectedCount = integrations.filter((i) => i.status === "connected").length;
  const liveConnectedCount = integrations.filter((i) => i.status === "connected" && i.isLive).length;

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
        title="Integrations"
        description="Connect financial, sales, payroll, and operations systems"
      />

      {notice && (
        <div className="mb-6 rounded-xl border bg-primary/5 p-4 text-sm">{notice}</div>
      )}

      <div className="mb-6 flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
        <div>
          <p className="font-medium">
            {connectedCount} of {integrations.length} integrations connected
            {liveConnectedCount > 0 ? ` (${liveConnectedCount} live)` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            QuickBooks and Plaid are live — mock connectors are labeled Demo/Mock
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleSyncAll} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sync All
        </Button>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{categoryLabels[category]}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations
              .filter((i) => i.category === category)
              .map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  id={integration.id}
                  name={integration.name}
                  logo={integration.logo}
                  description={integration.description}
                  status={integration.status as IntegrationStatus}
                  lastSync={integration.lastSync}
                  isLive={integration.isLive}
                  errorMessage={integration.errorMessage}
                  metadata={integration.metadata}
                  organizationId={organization.id}
                  onUpdate={fetchIntegrations}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
