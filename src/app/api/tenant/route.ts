import { NextResponse } from "next/server";
import { getFullTenantData } from "@/lib/data/tenant";
import { requireApiAccess } from "@/lib/auth/access";
import { AuthError, authErrorResponse } from "@/lib/auth/api";
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

    const result = await getFullTenantData(selected.organizationId);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
