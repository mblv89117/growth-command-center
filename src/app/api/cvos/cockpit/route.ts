import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";
import { buildExecutiveCockpit } from "@/lib/cvos/cockpit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("organizationId");
    const access = await requireApiAccess({ organizationId: requested });
    requirePermission(access, "dashboard:read");

    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: requested,
      role: access.role,
    });
    if (selected.denied) {
      return NextResponse.json({ error: selected.reason ?? "forbidden" }, { status: 403 });
    }

    const cockpit = buildExecutiveCockpit(selected.organizationId);
    if (!cockpit) {
      return NextResponse.json(
        { error: "cvos_unavailable", message: "Client Value OS data not available for this tenant" },
        { status: 404 },
      );
    }

    return NextResponse.json(cockpit);
  } catch (error) {
    return authErrorResponse(error);
  }
}
