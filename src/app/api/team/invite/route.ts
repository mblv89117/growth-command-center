import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/api/errors";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { sendTeamInvite } from "@/lib/data/team-invite";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { teamInviteSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, teamInviteSchema);
    const access = await requireApiAccess({ organizationId: body.organizationId });
    requirePermission(access, "team:manage");

    if (access.isDemoMode) {
      return NextResponse.json({
        success: false,
        preview: true,
        message: `Demo preview only — no invitation was sent to ${body.email}. Sign in to invite team members.`,
        email: body.email,
        role: body.role,
      });
    }

    const result = await sendTeamInvite({
      organizationId: body.organizationId,
      email: body.email,
      role: body.role,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          preview: false,
          message: `Invitation could not be sent: ${result.message}`,
          email: body.email,
          role: body.role,
        },
        { status: 501 }
      );
    }

    return NextResponse.json({
      success: true,
      preview: false,
      message: `Invitation sent to ${body.email}.`,
      email: body.email,
      role: body.role,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
