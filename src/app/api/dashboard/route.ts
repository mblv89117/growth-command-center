import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { AuthError, authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("organizationId");
    const access = await requireApiAccess(requested ? { organizationId: requested } : undefined);
    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: requested,
      role: access.role,
    });
    if (selected.denied) throw new AuthError("Forbidden", 403);

    const data = await getDashboardData(selected.organizationId);
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}
