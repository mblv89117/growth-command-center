import { NextResponse } from "next/server";
import { syncQuickBooks } from "@/lib/integrations/quickbooks";
import { syncPlaidBalances } from "@/lib/integrations/plaid";
import { getConnection, recordSyncResult } from "@/lib/integrations/store";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { authErrorResponse, AuthError } from "@/lib/auth/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const access = await requireApiAccess({ organizationId });
    requirePermission(access, "integrations:manage");

    const results = [];

    const qb = await getConnection(organizationId, "quickbooks");
    if (qb?.status === "connected") {
      const result = await syncQuickBooks(organizationId);
      recordSyncResult(organizationId, "quickbooks", result);
      results.push(result);
    }

    const plaid = await getConnection(organizationId, "plaid");
    if (plaid?.status === "connected") {
      const result = await syncPlaidBalances(organizationId);
      recordSyncResult(organizationId, "plaid", result);
      results.push(result);
    }

    if (results.length === 0) {
      const qbResult = await syncQuickBooks(organizationId);
      recordSyncResult(organizationId, "quickbooks", qbResult);
      results.push(qbResult);
    }

    return NextResponse.json({
      results,
      message: "Sync complete",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
