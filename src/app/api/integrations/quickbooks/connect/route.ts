import { NextResponse } from "next/server";
import { isDemoModeAllowed, isQuickBooksConfigured } from "@/lib/config";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { sanitizeConnectionForClient } from "@/lib/integrations/types";
import { connectQuickBooksDemo, getQuickBooksAuthUrl } from "@/lib/integrations/quickbooks";
import { createSignedQuickBooksState } from "@/lib/integrations/oauth-state";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, demo } = body as { organizationId?: string; demo?: boolean };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const access = await requireApiAccess({ organizationId });
    requirePermission(access, "integrations:manage");

    const useDemo = isDemoModeAllowed() && (Boolean(demo) || !isQuickBooksConfigured());
    if (useDemo) {
      const connection = await connectQuickBooksDemo(organizationId);
      return NextResponse.json({
        mode: "demo",
        connection: sanitizeConnectionForClient(connection),
        message: "QuickBooks connected",
      });
    }

    if (!isQuickBooksConfigured()) {
      return NextResponse.json(
        { error: "Configure QuickBooks credentials for production" },
        { status: 400 }
      );
    }

    const state = createSignedQuickBooksState({
      organizationId: access.organizationId,
      userId: access.userId,
    });
    return NextResponse.json({ mode: "oauth", authUrl: getQuickBooksAuthUrl(state) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
