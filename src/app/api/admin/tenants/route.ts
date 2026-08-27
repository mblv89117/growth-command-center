import { NextResponse } from "next/server";
import { requirePlatformAdminAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { getPlatformTenantDirectory } from "@/lib/admin/platform-tenants";

export async function GET() {
  try {
    await requirePlatformAdminAccess();
    const directory = await getPlatformTenantDirectory();
    if (!directory) {
      return NextResponse.json({ error: "Unable to load tenant directory" }, { status: 503 });
    }
    return NextResponse.json(directory);
  } catch (error) {
    return authErrorResponse(error);
  }
}
