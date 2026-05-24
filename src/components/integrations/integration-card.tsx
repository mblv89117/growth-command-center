"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { IntegrationStatus } from "@/lib/types";
import { Loader2, RefreshCw } from "lucide-react";

interface IntegrationCardProps {
  id: string;
  name: string;
  logo: string;
  description: string;
  status: IntegrationStatus;
  lastSync?: string;
  isLive?: boolean;
  metadata?: Record<string, string | number>;
  organizationId: string;
  onUpdate: () => void;
}

const statusConfig = {
  connected: { label: "Connected", variant: "success" as const },
  disconnected: { label: "Disconnected", variant: "secondary" as const },
  pending: { label: "Pending", variant: "warning" as const },
  error: { label: "Error", variant: "destructive" as const },
};

const LIVE_INTEGRATIONS: Record<string, { connect: string; sync: string; disconnect: string }> = {
  "int-1": {
    connect: "/api/integrations/quickbooks/connect",
    sync: "/api/integrations/quickbooks/sync",
    disconnect: "/api/integrations/quickbooks/disconnect",
  },
  "int-4": {
    connect: "/api/integrations/plaid/connect",
    sync: "/api/integrations/plaid/sync",
    disconnect: "/api/integrations/plaid/disconnect",
  },
};

export function IntegrationCard({
  id,
  name,
  logo,
  description,
  status,
  lastSync,
  isLive,
  metadata,
  organizationId,
  onUpdate,
}: IntegrationCardProps) {
  const [loading, setLoading] = useState(false);
  const config = statusConfig[status];
  const routes = LIVE_INTEGRATIONS[id];
  const isLiveIntegration = Boolean(routes);

  const handleConnect = async () => {
    if (!routes) return;
    setLoading(true);
    try {
      const res = await fetch(routes.connect, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, demo: true }),
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!routes) return;
    setLoading(true);
    try {
      await fetch(routes.sync, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!routes) return;
    setLoading(true);
    try {
      await fetch(routes.disconnect, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {logo}
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <div className="mt-1 flex gap-1">
                <Badge variant={config.variant}>{config.label}</Badge>
                {isLive && (
                  <Badge variant="outline" className="text-xs">
                    Live
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-4">{description}</CardDescription>
        {lastSync && (
          <p className="mb-2 text-xs text-muted-foreground">Last synced: {formatDate(lastSync)}</p>
        )}
        {metadata?.totalBalance != null && (
          <p className="mb-2 text-xs text-muted-foreground">
            Total balance: ${Number(metadata.totalBalance).toLocaleString()}
          </p>
        )}
        {metadata?.lastRecordsSynced && (
          <p className="mb-4 text-xs text-muted-foreground">
            {metadata.lastRecordsSynced} records synced
          </p>
        )}
        <div className="flex gap-2">
          {status === "connected" ? (
            <>
              {isLiveIntegration && (
                <Button variant="outline" size="sm" className="flex-1" onClick={handleSync} disabled={loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                  Sync
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleDisconnect}
                disabled={loading || !isLiveIntegration}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" className="w-full" onClick={handleConnect} disabled={loading || !isLiveIntegration}>
              {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              {isLiveIntegration ? "Connect" : "Coming Soon"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
