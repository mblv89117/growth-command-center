import { NextResponse } from "next/server";
import { getFullTenantData } from "@/lib/data/tenant";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? "org-apex";

    await requireApiAccess({ organizationId });

    const result = await getFullTenantData(organizationId);
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
