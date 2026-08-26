import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import {
  CONNECTOR_REGISTRY,
  getOrganizationConnectorHealth,
} from "@/lib/connectors";

const CATEGORY_ORDER = [
  "accounting",
  "banking",
  "payments",
  "payroll",
  "crm",
  "operations",
  "spreadsheets",
  "uploads",
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    await requireApiAccess({ organizationId });

    const health = await getOrganizationConnectorHealth(organizationId);

    const byCategory = CATEGORY_ORDER.map((category) => ({
      category,
      connectors: health.filter((h) => {
        const def = CONNECTOR_REGISTRY.find((c) => c.id === h.connectorId);
        return def?.category === category;
      }),
    }));

    const liveCount = CONNECTOR_REGISTRY.filter((c) => c.isProductionLive).length;
    const falseLive = CONNECTOR_REGISTRY.filter(
      (c) => c.isProductionLive && !c.isConfigured
    ).length;

    return NextResponse.json({
      registry: CONNECTOR_REGISTRY.map((def) => ({
        id: def.id,
        name: def.name,
        category: def.category,
        wave: def.wave,
        description: def.description,
        isProductionLive: def.isProductionLive,
        requiresProviderApproval: def.requiresProviderApproval,
        readOnly: def.readOnly,
        logo: def.logo,
      })),
      health,
      byCategory,
      summary: {
        total: CONNECTOR_REGISTRY.length,
        live: liveCount,
        falseLive,
        uploadPathsLive: ["csv", "xlsx", "pdf"].filter((id) =>
          CONNECTOR_REGISTRY.find((c) => c.id === id)?.isProductionLive
        ),
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
