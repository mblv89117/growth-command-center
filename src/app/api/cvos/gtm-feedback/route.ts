import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission, requirePlatformAdminAccess } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";
import { assertGtmFeedbackSafe, getGtmFeedback } from "@/lib/cvos/signals";

export const runtime = "nodejs";

/**
 * Aggregated GTM feedback — platform_admin or advisor with reports:export.
 * Never returns raw client financials.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("organizationId");

    // Prefer platform admin for cross-tenant GTM learning; tenant users get own aggregate only.
    let organizationId: string;
    try {
      const admin = await requirePlatformAdminAccess();
      organizationId = requested?.trim() || admin.organizationId;
    } catch {
      const access = await requireApiAccess({ organizationId: requested });
      requirePermission(access, "reports:export");
      const selected = selectOrganizationId({
        authOrganizationId: access.organizationId,
        requestedOrganizationId: requested,
        role: access.role,
      });
      if (selected.denied) {
        return NextResponse.json({ error: selected.reason ?? "forbidden" }, { status: 403 });
      }
      organizationId = selected.organizationId;
    }

    const feedback = getGtmFeedback(organizationId);
    if (!feedback) {
      return NextResponse.json({ error: "cvos_unavailable" }, { status: 404 });
    }
    const issues = assertGtmFeedbackSafe(feedback);
    if (issues.length > 0) {
      return NextResponse.json({ error: "unsafe_gtm_payload", issues }, { status: 500 });
    }
    return NextResponse.json(feedback);
  } catch (error) {
    return authErrorResponse(error);
  }
}
