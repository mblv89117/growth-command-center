"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/lib/tenant/context";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface ConnectorHealthRow {
  connectorId: string;
  state: string;
  stateLabel: string;
  connectedAt?: string;
  lastSuccessfulSync?: string;
  recordsSynced?: number;
  errorMessage?: string;
  provenanceSource?: string;
}

const STATE_ICONS: Record<string, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  connected: CheckCircle2,
  needs_attention: AlertTriangle,
  error: AlertTriangle,
  reauthorize: AlertTriangle,
};

export function ConnectionHealthCenter() {
  const { organization } = useTenant();
  const [health, setHealth] = useState<ConnectorHealthRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    const res = await fetch(`/api/connectors?organizationId=${organization.id}`);
    const data = await res.json();
    setHealth(data.health ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, [organization.id]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connected = health.filter((h) =>
    ["connected", "healthy", "syncing", "needs_attention"].includes(h.state)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Connection Health</CardTitle>
          <CardDescription>
            {connected.length} active connection{connected.length !== 1 ? "s" : ""} · Last checked just now
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {connected.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No systems connected yet. Use Connect My Systems or Upload My Data to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {connected.map((row) => {
              const Icon = STATE_ICONS[row.state] ?? CheckCircle2;
              return (
                <div
                  key={row.connectorId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium capitalize">{row.connectorId.replace(/_/g, " ")}</p>
                      {row.lastSuccessfulSync && (
                        <p className="text-xs text-muted-foreground">
                          Last synced: {formatDate(row.lastSuccessfulSync)}
                          {row.recordsSynced ? ` · ${row.recordsSynced} records` : ""}
                        </p>
                      )}
                      {row.errorMessage && (
                        <p className="text-xs text-destructive">{row.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={row.state === "healthy" ? "default" : "secondary"}>
                    {row.stateLabel}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
