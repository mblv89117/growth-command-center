import { NextResponse } from "next/server";
import { syncQuickBooks } from "@/lib/integrations/quickbooks";
import { recordSyncResult } from "@/lib/integrations/store";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    await requireApiAccess({ organizationId });

    const result = await syncQuickBooks(organizationId);
    await recordSyncResult(organizationId, "quickbooks", result);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
