import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { requireAuth, authErrorResponse } from "@/lib/auth/api";
import { DEMO_MODE_COOKIE, isDemoModeAllowed, isProduction } from "@/lib/config";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const demoMode =
      isDemoModeAllowed() && cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";

    let organizationId = searchParams.get("organizationId") ?? "org-apex";

    if (isProduction && !demoMode) {
      const auth = await requireAuth();
      organizationId = searchParams.get("organizationId") ?? auth.organizationId;
      if (organizationId !== auth.organizationId && auth.role !== "platform_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const data = await getDashboardData(organizationId);
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}
