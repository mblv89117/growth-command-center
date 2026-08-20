import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/api";
import { requireApiAccess, requirePermission } from "@/lib/auth/access";
import { selectOrganizationId } from "@/lib/auth/organization";
import { approveExecutiveBrief, canDeliverExternally, getExecutiveBrief } from "@/lib/cvos/executive-brief";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get("organizationId");
    const access = await requireApiAccess();
    requirePermission(access, "reports:read");

    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: requested,
      role: access.role,
    });
    if (selected.denied) {
      return NextResponse.json({ error: selected.reason ?? "forbidden" }, { status: 403 });
    }

    const brief = getExecutiveBrief(selected.organizationId);
    if (!brief) {
      return NextResponse.json({ error: "cvos_unavailable" }, { status: 404 });
    }
    return NextResponse.json({
      brief,
      externalDeliveryAllowed: canDeliverExternally(brief.status),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      organizationId?: string;
      action?: string;
      approvedBy?: string;
    };
    const access = await requireApiAccess();
    requirePermission(access, "reports:export");

    const selected = selectOrganizationId({
      authOrganizationId: access.organizationId,
      requestedOrganizationId: body.organizationId,
      role: access.role,
    });
    if (selected.denied) {
      return NextResponse.json({ error: selected.reason ?? "forbidden" }, { status: 403 });
    }

    const brief = getExecutiveBrief(selected.organizationId);
    if (!brief) {
      return NextResponse.json({ error: "cvos_unavailable" }, { status: 404 });
    }

    if (body.action !== "approve") {
      return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
    }

    const result = approveExecutiveBrief(brief, body.approvedBy ?? access.email);
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({
      brief: result,
      externalDeliveryAllowed: canDeliverExternally(result.status),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
