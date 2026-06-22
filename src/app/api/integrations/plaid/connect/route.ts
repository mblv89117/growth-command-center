import { NextResponse } from "next/server";
import { isDemoModeAllowed } from "@/lib/config";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { sanitizeConnectionForClient } from "@/lib/integrations/types";
import { connectPlaidDemo, createPlaidLinkToken, isPlaidConfigured } from "@/lib/integrations/plaid";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, demo } = body as { organizationId?: string; demo?: boolean };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const access = await requireApiAccess({ organizationId });
    requirePermission(access, "integrations:manage");

    const useDemo = demo || !isPlaidConfigured();
    if (useDemo) {
      if (!isDemoModeAllowed()) {
        return NextResponse.json({ error: "Configure Plaid credentials for production" }, { status: 400 });
      }
      const connection = await connectPlaidDemo(organizationId);
      return NextResponse.json({
        mode: "demo",
        connection: sanitizeConnectionForClient(connection),
        message: "Plaid connected",
      });
    }

    const linkToken = await createPlaidLinkToken(organizationId);
    return NextResponse.json({ mode: "link", linkToken });
  } catch (error) {
    return authErrorResponse(error);
  }
}
