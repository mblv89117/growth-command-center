import { NextResponse } from "next/server";
import { isDemoModeAllowed, isQuickBooksConfigured } from "@/lib/config";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { sanitizeConnectionForClient } from "@/lib/integrations/types";
import { connectQuickBooksDemo, getQuickBooksAuthUrl } from "@/lib/integrations/quickbooks";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, demo } = body as { organizationId?: string; demo?: boolean };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const access = await requireApiAccess({ organizationId });
    requirePermission(access, "integrations:manage");

    const useDemo = demo || !isQuickBooksConfigured();
    if (useDemo) {
      if (!isDemoModeAllowed()) {
        return NextResponse.json({ error: "Configure QuickBooks credentials for production" }, { status: 400 });
      }
      const connection = await connectQuickBooksDemo(organizationId);
      return NextResponse.json({
        mode: "demo",
        connection: sanitizeConnectionForClient(connection),
        message: "QuickBooks connected",
      });
    }

    const state = Buffer.from(JSON.stringify({ organizationId })).toString("base64url");
    return NextResponse.json({ mode: "oauth", authUrl: getQuickBooksAuthUrl(state) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
