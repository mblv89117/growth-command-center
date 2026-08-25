import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireApiAccess } from "@/lib/auth/access";
import { recomputeTenantFinancials } from "@/lib/pipeline/recompute";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { organizationId?: string };
    if (!body.organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    await requireApiAccess({ organizationId: body.organizationId });
    const result = await recomputeTenantFinancials(body.organizationId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
