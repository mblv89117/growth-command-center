import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { getOrganizationById } from "@/lib/data/organizations";
import { getFullTenantData } from "@/lib/data/tenant";
import {
  ClientWorkspaceError,
  assertClientWorkspaceAccess,
  isolateTenantPayload,
} from "@/lib/client-workspace";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? "org-apex";
    const requestedClientCode = searchParams.get("clientCode");

    await requireApiAccess({ organizationId });
    const organization = await getOrganizationById(organizationId);
    const clientCode = assertClientWorkspaceAccess(organization.clientCode, requestedClientCode);
    const tenant = await getFullTenantData(organizationId);

    return NextResponse.json(
      isolateTenantPayload(
        {
          organizationId,
          organizationName: organization.name,
          source: tenant.source,
          clientCode,
        },
        clientCode
      )
    );
  } catch (error) {
    if (error instanceof ClientWorkspaceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
