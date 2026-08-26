"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant/context";
import type { Integration, IntegrationStatus } from "@/lib/types";
import type { IntegrationAvailability } from "@/lib/integrations/catalog";
import { Download, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { ConnectionHealthCenter } from "@/components/connectors/connection-health-center";

const categoryLabels: Record<string, string> = {
  accounting: "Accounting",
  banking: "Banking",
  payments: "Payments",
  payroll: "Payroll",
  operations: "Operations",
  crm: "CRM / Sales",
  spreadsheets: "Spreadsheets",
  uploads: "File Uploads",
  sales: "Sales & CRM",
  other: "Other",
};

interface LiveIntegration extends Integration {
  isLive?: boolean;
  metadata?: Record<string, string | number>;
  connectedAt?: string;
  errorMessage?: string;
  connectConfigured?: boolean;
  availability?: IntegrationAvailability;
  availabilityLabel?: string;
}

export default function IntegrationsContent() {
  const { organization } = useTenant();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<LiveIntegration[]>([]);
  const [loading, setLoading] = useState(true);
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
    const error = searchParams.get("error");
    if (error) {
      setNotice(`Integration error: ${error}`);
    }
  }, [searchParams]);

  const nativeIntegrations = integrations.filter((i) => i.availability !== "live");
  const categories = [...new Set(nativeIntegrations.map((i) => i.category))];

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
        title="Data Connections"
        description="Connect your systems or upload your data — two first-class paths to financial intelligence"
      />

      {notice && (
        <div className="mb-6 rounded-xl border bg-primary/5 p-4 text-sm">{notice}</div>
      )}

      <div className="mb-8">
        <ConnectionHealthCenter />
      </div>

      <div className="mb-8 rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Upload My Data</h2>
              <Badge>Live</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              CSV, Excel, and PDF financial reports — map, preview, validate, and confirm before commit.
            </p>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              <li>Supported: CSV, XLS, XLSX, PDF (P&L, balance sheet, cash flow)</li>
              <li>PDF values require your confirmation before becoming financial truth</li>
              <li>Templates and field guidance included</li>
            </ul>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button asChild size="lg">
              <Link href="/integrations/import">
                <Upload className="mr-2 h-4 w-4" />
                Import files
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/templates/import-template-financial-snapshot.csv" download>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Connect My Systems</p>
        <p className="mt-1">
          Native connectors sync automatically when production-certified. Providers below show honest
          status — we never mark a connector live until authorization and sync are verified.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{categoryLabels[category]}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nativeIntegrations
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
                  connectConfigured={integration.connectConfigured}
                  availability={integration.availability}
                  availabilityLabel={integration.availabilityLabel}
                  onUpdate={fetchIntegrations}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
