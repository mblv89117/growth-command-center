import { NextResponse } from "next/server";
import { disconnectPlaid } from "@/lib/integrations/plaid";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const access = await requireApiAccess({ organizationId });
    requirePermission(access, "integrations:manage");

    const ok = await disconnectPlaid(organizationId);
    return NextResponse.json({ success: ok });
  } catch (error) {
    return authErrorResponse(error);
  }
}
