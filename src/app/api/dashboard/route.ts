import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess } from "@/lib/auth/access";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? "org-apex";

    await requireApiAccess({ organizationId });

    const data = await getDashboardData(organizationId);
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}
