import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { sendTeamInvite } from "@/lib/data/team-invite";

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

    if (access.isDemoMode) {
      return NextResponse.json({
        success: false,
        preview: true,
        message: `Demo preview only — no invitation was sent to ${email}. Sign in to invite team members.`,
        email,
        role,
      });
    }

    const result = await sendTeamInvite({ organizationId, email, role });
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          preview: false,
          message: `Invitation could not be sent: ${result.message}`,
          email,
          role,
        },
        { status: 501 }
      );
    }

    return NextResponse.json({
      success: true,
      preview: false,
      message: `Invitation sent to ${email}.`,
      email,
      role,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
