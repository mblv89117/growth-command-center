import { NextResponse } from "next/server";
import { getTenantData } from "@/lib/mock-data";
import { getConnection, getOrganizationConnections } from "@/lib/integrations/store";
import { isDemoConnection, sanitizeConnectionForClient } from "@/lib/integrations/types";
import type { IntegrationProvider } from "@/lib/integrations/types";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { isProduction, isQuickBooksConfigured } from "@/lib/config";
import { isPlaidConfigured } from "@/lib/integrations/plaid";
import {
  FILE_IMPORT_CAPABILITY,
  normalizeIntegrationForProduction,
} from "@/lib/integrations/catalog";

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

const LIVE_CONNECT_IDS = new Set(["int-1", "int-4"]);

function isProviderConfigured(provider?: IntegrationProvider): boolean {
  if (provider === "quickbooks") return isQuickBooksConfigured();
  if (provider === "plaid") return isPlaidConfigured();
  return false;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    await requireApiAccess({ organizationId });

    const mockIntegrations = getTenantData(organizationId).integrations;
    const liveConnections = await getOrganizationConnections(organizationId);

    const integrations = await Promise.all(
      mockIntegrations.map(async (integration) => {
        const provider = PROVIDER_MAP[integration.id];
        const live = provider ? await getConnection(organizationId, provider) : undefined;
        const usableLive = live && !(isProduction && isDemoConnection(live)) ? live : undefined;
        const connectConfigured = isProviderConfigured(provider);

        if (usableLive) {
          return {
            ...integration,
            status: usableLive.status,
            lastSync: usableLive.lastSync,
            connectedAt: usableLive.connectedAt,
            errorMessage: usableLive.errorMessage,
            metadata: usableLive.metadata,
            isLive: true,
            connectConfigured,
            availability: "live",
            availabilityLabel: "Live",
          };
        }

        const base = {
          ...integration,
          status: "disconnected" as const,
          lastSync: undefined,
          connectedAt: undefined,
          errorMessage: connectConfigured
            ? undefined
            : `${integration.name} is not yet available for self-service connection`,
          isLive: false,
          connectConfigured,
        };

        if (isProduction) {
          return normalizeIntegrationForProduction(base, connectConfigured);
        }

        if (LIVE_CONNECT_IDS.has(integration.id)) {
          return {
            ...base,
            availability: connectConfigured ? "partial" : "coming_soon",
            availabilityLabel: connectConfigured ? "Partial" : "Coming Soon",
          };
        }

        return {
          ...base,
          availability: "coming_soon",
          availabilityLabel: "Coming Soon",
        };
      })
    );

    const visibleConnections = isProduction
      ? liveConnections.filter((connection) => !isDemoConnection(connection))
      : liveConnections;

    return NextResponse.json({
      integrations,
      connections: visibleConnections.map(sanitizeConnectionForClient),
      capabilities: {
        fileImport: FILE_IMPORT_CAPABILITY,
        quickbooks: { configured: isQuickBooksConfigured(), availability: "coming_soon" },
        plaid: { configured: isPlaidConfigured(), availability: "coming_soon" },
        nativeConnectorsLive: false,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
