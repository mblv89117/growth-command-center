import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";
import { buildValueCreationBoard } from "@/lib/cvos/value-creation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("organizationId");
    const access = await requireApiAccess({ organizationId: requested });
    requirePermission(access, "financials:read");

    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: requested,
      role: access.role,
    });
    if (selected.denied) {
      return NextResponse.json({ error: selected.reason ?? "forbidden" }, { status: 403 });
    }

    const board = buildValueCreationBoard(selected.organizationId);
    if (!board) {
      return NextResponse.json({ error: "cvos_unavailable" }, { status: 404 });
    }
    return NextResponse.json(board);
  } catch (error) {
    return authErrorResponse(error);
  }
}
