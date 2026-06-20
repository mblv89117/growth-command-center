import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, email, role } = body as {
      organizationId?: string;
      email?: string;
      role?: string;
    };

    if (!organizationId || !email || !role) {
      return NextResponse.json(
        { error: "organizationId, email, and role are required" },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const access = await requireApiAccess({ organizationId });

    return NextResponse.json({
      success: true,
      message: access.isDemoMode
        ? `Preview invite queued for ${email}. Email delivery is disabled in demo mode.`
        : `Invitation sent to ${email}.`,
      preview: access.isDemoMode,
      email,
      role,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
