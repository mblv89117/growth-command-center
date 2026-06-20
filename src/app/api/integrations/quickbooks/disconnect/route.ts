import { NextResponse } from "next/server";
import { disconnectQuickBooks } from "@/lib/integrations/quickbooks";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    await requireApiAccess({ organizationId });

    const disconnected = await disconnectQuickBooks(organizationId);
    return NextResponse.json({ success: disconnected });
  } catch (error) {
    return authErrorResponse(error);
  }
}
