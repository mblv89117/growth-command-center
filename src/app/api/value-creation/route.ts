import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireApiAccess } from "@/lib/auth/access";
import { getDashboardData } from "@/lib/data/dashboard";
import { analyzeValueCreation } from "@/lib/value-creation/analyze";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    await requireApiAccess({ organizationId });

    const dashboard = await getDashboardData(organizationId);
    const board = analyzeValueCreation({
      organizationId,
      snapshot: dashboard.financialSnapshot,
      trends: dashboard.monthlyTrends,
      kpis: dashboard.kpis,
      alerts: dashboard.alerts,
    });

    return NextResponse.json(board);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
