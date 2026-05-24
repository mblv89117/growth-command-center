import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getFullTenantData } from "@/lib/data/tenant";
import { DEMO_MODE_COOKIE, isDemoModeAllowed, isProduction } from "@/lib/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") ?? "org-apex";

  if (isProduction) {
    const cookieStore = await cookies();
    const demoMode = isDemoModeAllowed() && cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";
    if (!demoMode) {
      const { requireAuth } = await import("@/lib/auth/api");
      try {
        const auth = await requireAuth();
        if (organizationId !== auth.organizationId && auth.role !== "platform_admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  const result = await getFullTenantData(organizationId);
  return NextResponse.json(result);
}
