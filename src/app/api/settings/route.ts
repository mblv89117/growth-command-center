import { NextResponse } from "next/server";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { persistOrganizationSettings } from "@/lib/data/settings";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, section, settings } = body as {
      organizationId?: string;
      section?: string;
      settings?: Record<string, unknown>;
    };

    if (!organizationId || !section || !settings) {
      return NextResponse.json(
        { error: "organizationId, section, and settings are required" },
        { status: 400 }
      );
    }

    const access = await requireApiAccess({ organizationId });
    requirePermission(access, "settings:manage");

    if (access.isDemoMode) {
      return NextResponse.json({
        success: false,
        preview: true,
        message:
          "Demo preview only — settings were not saved to the database. Sign in to persist changes.",
        section,
      });
    }

    const result = await persistOrganizationSettings(organizationId, section, settings);
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          preview: false,
          message: `Settings could not be saved: ${result.message}`,
          section,
        },
        { status: 501 }
      );
    }

    return NextResponse.json({
      success: true,
      preview: false,
      message: "Settings saved successfully.",
      section,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
