import { NextResponse } from "next/server";
import { getFullTenantData } from "@/lib/data/tenant";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { AuthError, authErrorResponse } from "@/lib/auth/api";
import { selectOrganizationId } from "@/lib/auth/organization";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("organizationId");
    // Session is authoritative; browser org is compared only.
    const access = await requireApiAccess();
    requirePermission(access, "financials:read");

    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: requested,
      role: access.role,
    });
    if (selected.denied) throw new AuthError("Forbidden", 403);

    // GCC-RT-05: never use the raw browser string for data access.
    const result = await getFullTenantData(selected.organizationId);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
