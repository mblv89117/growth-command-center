import { z } from "zod";
import { NextResponse } from "next/server";
import { generateAdvisorInsights } from "@/lib/ai/advisor";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { getDashboardData } from "@/lib/data/dashboard";
import { AI_ADVISOR_RATE_LIMIT } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { organizationIdSchema } from "@/lib/validation/schemas";

const aiAdvisorBodySchema = organizationIdSchema.extend({
  department: z
    .enum(["executive", "finance", "sales", "operations"])
    .optional(),
});

async function getOrganizationName(organizationId: string): Promise<string> {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("gcc_organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    if (data?.name) return data.name as string;
  }
  return organizationId;
}

export async function POST(request: Request) {
  try {
    const { body } = await requireSecureTenantRequest({
      request,
      schema: aiAdvisorBodySchema,
      rateLimit: {
        route: "ai-advisor",
        ...AI_ADVISOR_RATE_LIMIT,
      },
    });

    const [dashboard, organizationName] = await Promise.all([
      getDashboardData(body.organizationId),
      getOrganizationName(body.organizationId),
    ]);

    const insights = await generateAdvisorInsights({
      organizationName,
      department: body.department,
      dashboard,
    });

    return NextResponse.json({
      insights,
      organizationId: body.organizationId,
      wordCount: insights.split(/\s+/).filter(Boolean).length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
