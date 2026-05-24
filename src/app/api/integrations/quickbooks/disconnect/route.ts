import { NextResponse } from "next/server";
import { disconnectQuickBooks } from "@/lib/integrations/quickbooks";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";
import { isProduction } from "@/lib/config";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    if (isProduction) await requireAuth();

    const disconnected = await disconnectQuickBooks(organizationId);
    return NextResponse.json({ success: disconnected });
  } catch (error) {
    return authErrorResponse(error);
  }
}
