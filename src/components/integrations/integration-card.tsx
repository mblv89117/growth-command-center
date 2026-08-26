"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { IntegrationStatus } from "@/lib/types";
import type { IntegrationAvailability } from "@/lib/integrations/catalog";

interface IntegrationCardProps {
  id: string;
  name: string;
  logo: string;
  description: string;
  status: IntegrationStatus;
  lastSync?: string;
  isLive?: boolean;
  errorMessage?: string;
  metadata?: Record<string, string | number>;
  organizationId: string;
  connectConfigured?: boolean;
  availability?: IntegrationAvailability;
  availabilityLabel?: string;
  onUpdate: () => void;
}

const statusConfig = {
  connected: { label: "Connected", variant: "success" as const },
  disconnected: { label: "Disconnected", variant: "secondary" as const },
  pending: { label: "Pending", variant: "warning" as const },
  error: { label: "Error", variant: "destructive" as const },
};

export function IntegrationCard({
  name,
  logo,
  description,
  status,
  lastSync,
  isLive,
  availability = "coming_soon",
  availabilityLabel = "Coming Soon",
}: IntegrationCardProps) {
  const config = statusConfig[status];
  const isComingSoon = availability === "coming_soon" || availability === "not_implemented";

  return (
    <Card className={isComingSoon ? "opacity-90" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
              {logo}
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <div className="mt-1 flex flex-wrap gap-1">
                {isLive ? (
                  <Badge variant="outline" className="text-xs">
                    Live
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {availabilityLabel}
                  </Badge>
                )}
                {!isComingSoon && <Badge variant={config.variant}>{config.label}</Badge>}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-4">{description}</CardDescription>
        {lastSync && isLive && (
          <p className="mb-2 text-xs text-muted-foreground">Last synced: {formatDate(lastSync)}</p>
        )}
        {isComingSoon ? (
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Not available for self-service connection yet. Import your data via{" "}
            <span className="font-medium text-foreground">CSV / XLSX</span> on the Import page.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
