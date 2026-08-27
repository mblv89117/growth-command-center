import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdminAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/supabase/admin";

const entitlementSchema = z.object({
  accessType: z.enum(["trial", "standalone", "hvcg_included", "inactive"]),
  hvcgEngagementActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const auth = await requirePlatformAdminAccess();
    const { organizationId } = await params;
    const body = entitlementSchema.parse(await request.json());
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const patch: Record<string, unknown> = {
      access_type: body.accessType,
    };

    if (body.accessType === "hvcg_included") {
      patch.hvcg_engagement_active = body.hvcgEngagementActive ?? true;
      patch.hvcg_client_since = new Date().toISOString();
      patch.subscription_status = "active";
    } else if (body.accessType === "inactive") {
      patch.hvcg_engagement_active = false;
      patch.subscription_status = "canceled";
    } else if (body.accessType === "trial") {
      patch.hvcg_engagement_active = false;
      patch.subscription_status = "trial";
      patch.trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      patch.hvcg_engagement_active = false;
    }

    const { data, error } = await admin
      .from("gcc_organizations")
      .update(patch)
      .eq("id", organizationId)
      .select("id, name, access_type, subscription_status, hvcg_engagement_active")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update entitlement" }, { status: 400 });
    }

    await admin.from("gcc_admin_audit").insert({
      actor_user_id: auth.userId,
      organization_id: organizationId,
      action: "entitlement_updated",
      detail: JSON.stringify(patch),
    });

    return NextResponse.json({ organization: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
