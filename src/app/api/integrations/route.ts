import { NextResponse } from "next/server";
import { getTenantData } from "@/lib/mock-data";
import { getConnection, getOrganizationConnections } from "@/lib/integrations/store";
import type { IntegrationProvider } from "@/lib/integrations/types";

const PROVIDER_MAP: Record<string, IntegrationProvider> = {
  "int-1": "quickbooks",
  "int-2": "xero",
  "int-3": "stripe",
  "int-4": "plaid",
  "int-5": "gusto",
  "int-6": "buildertrend",
  "int-7": "hubspot",
  "int-8": "salesforce",
  "int-9": "jobber",
  "int-10": "google_sheets",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const mockIntegrations = getTenantData(organizationId).integrations;
  const liveConnections = await getOrganizationConnections(organizationId);

  const integrations = await Promise.all(
    mockIntegrations.map(async (integration) => {
      const provider = PROVIDER_MAP[integration.id];
      const live = provider ? await getConnection(organizationId, provider) : undefined;

      if (live) {
        return {
          ...integration,
          status: live.status,
          lastSync: live.lastSync,
          connectedAt: live.connectedAt,
          errorMessage: live.errorMessage,
          metadata: live.metadata,
          isLive: true,
        };
      }

      return { ...integration, isLive: false };
    })
  );

  return NextResponse.json({ integrations, connections: liveConnections });
}
