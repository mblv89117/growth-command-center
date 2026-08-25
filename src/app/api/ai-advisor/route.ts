import { z } from "zod";
import { NextResponse } from "next/server";
import { generateAdvisorInsights } from "@/lib/ai/advisor";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { getDashboardData } from "@/lib/data/dashboard";
import { AI_ADVISOR_RATE_LIMIT } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { organizationIdSchema } from "@/lib/validation/schemas";
import { logOperationalEvent } from "@/lib/observability/events";

const aiAdvisorBodySchema = organizationIdSchema.extend({
  department: z
    .enum(["executive", "finance", "sales", "operations"])
    .optional(),
  message: z.string().max(2000).optional(),
  conversationId: z.string().uuid().optional(),
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

async function loadConversationHistory(
  conversationId: string | undefined,
  organizationId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  if (!conversationId) return [];
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("gcc_ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(10);

  return (data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));
}

async function saveConversation(
  organizationId: string,
  userId: string,
  conversationId: string | undefined,
  userMessage: string | undefined,
  assistantResponse: string
): Promise<string | undefined> {
  const admin = createAdminClient();
  if (!admin || !userMessage) return conversationId;

  let convId = conversationId;
  if (!convId) {
    const { data } = await admin
      .from("gcc_ai_conversations")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        title: userMessage.slice(0, 80),
      })
      .select("id")
      .single();
    convId = data?.id as string | undefined;
  }

  if (!convId) return undefined;

  await admin.from("gcc_ai_messages").insert([
    { conversation_id: convId, organization_id: organizationId, role: "user", content: userMessage },
    {
      conversation_id: convId,
      organization_id: organizationId,
      role: "assistant",
      content: assistantResponse,
      data_sources: ["financial_snapshot", "kpis", "alerts"],
    },
  ]);

  return convId;
}

export async function POST(request: Request) {
  try {
    const { access, body } = await requireSecureTenantRequest({
      request,
      schema: aiAdvisorBodySchema,
      rateLimit: {
        route: "ai-advisor",
        ...AI_ADVISOR_RATE_LIMIT,
      },
    });

    const [dashboard, organizationName, history] = await Promise.all([
      getDashboardData(body.organizationId),
      getOrganizationName(body.organizationId),
      loadConversationHistory(body.conversationId, body.organizationId),
    ]);

    const insights = await generateAdvisorInsights({
      organizationName,
      department: body.department,
      dashboard,
      userMessage: body.message,
      conversationHistory: history,
    });

    const conversationId = await saveConversation(
      body.organizationId,
      access.userId,
      body.conversationId,
      body.message,
      insights
    );

    return NextResponse.json({
      insights,
      organizationId: body.organizationId,
      conversationId,
      wordCount: insights.split(/\s+/).filter(Boolean).length,
      dataSource: dashboard.source,
    });
  } catch (error) {
    logOperationalEvent("ai_advisor_failed", { route: "ai-advisor" });
    return apiErrorResponse(error);
  }
}
