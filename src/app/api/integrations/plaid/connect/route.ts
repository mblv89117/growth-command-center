import { NextResponse } from "next/server";
import { isDemoModeAllowed, isProduction } from "@/lib/config";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";
import { canManageIntegrations } from "@/lib/auth/permissions";
import { connectPlaidDemo, createPlaidLinkToken, isPlaidConfigured } from "@/lib/integrations/plaid";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, demo } = body as { organizationId?: string; demo?: boolean };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    if (isProduction) {
      const auth = await requireAuth();
      if (!canManageIntegrations(auth.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const useDemo = demo || !isPlaidConfigured();
    if (useDemo) {
      if (!isDemoModeAllowed()) {
        return NextResponse.json({ error: "Configure Plaid credentials for production" }, { status: 400 });
      }
      const connection = await connectPlaidDemo(organizationId);
      return NextResponse.json({ mode: "demo", connection, message: "Plaid connected" });
    }

    const linkToken = await createPlaidLinkToken(organizationId);
    return NextResponse.json({ mode: "link", linkToken });
  } catch (error) {
    return authErrorResponse(error);
  }
}
