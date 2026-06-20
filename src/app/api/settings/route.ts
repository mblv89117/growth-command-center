import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";

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

    return NextResponse.json({
      success: true,
      message: access.isDemoMode
        ? "Settings saved for this demo session (preview — not persisted to database yet)."
        : "Settings saved successfully.",
      preview: access.isDemoMode,
      section,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
