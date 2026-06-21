import { NextResponse } from "next/server";
import { apiErrorResponse, ValidationError } from "@/lib/api/errors";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { AuthError } from "@/lib/auth/api";
import { hasPermission } from "@/lib/auth/permissions";
import { updateKpi } from "@/lib/kpi/store";
import { validateKpiPlan } from "@/lib/kpi/status";
import { kpiPatchSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request) {
  try {
    const { body, access } = await requireSecureTenantRequest({
      request,
      schema: kpiPatchSchema,
    });

    if (!access.isDemoMode && !hasPermission(access.role, "financials:write")) {
      throw new AuthError("Forbidden", 403);
    }

    const hasFieldUpdate =
      body.name !== undefined ||
      body.value !== undefined ||
      body.target !== undefined ||
      body.status !== undefined ||
      body.plan !== undefined;

    if (!hasFieldUpdate) {
      throw new ValidationError("At least one KPI field must be provided");
    }

    const planError = validateKpiPlan(body.status, body.plan ?? undefined);
    if (planError) {
      throw new ValidationError(planError);
    }

    const kpi = await updateKpi(
      body.organizationId,
      body.kpiKey,
      {
        name: body.name,
        value: body.value,
        target: body.target,
        status: body.status,
        plan: body.plan,
      },
      { demoMode: access.isDemoMode }
    );

    return NextResponse.json({
      success: true,
      kpi,
      preview: access.isDemoMode,
      message: access.isDemoMode
        ? "Demo preview — KPI update applied in demo session only."
        : "KPI updated successfully.",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
