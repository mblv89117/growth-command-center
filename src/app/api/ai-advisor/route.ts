import { z } from "zod";
import { NextResponse } from "next/server";
import { generateAdvisorInsights } from "@/lib/ai/advisor";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { getDashboardData } from "@/lib/data/dashboard";
import { getOnboardingState } from "@/lib/onboarding/store";
import { AI_ADVISOR_RATE_LIMIT } from "@/lib/rate-limit";
import {
  createAiConversation,
  fetchAiConversationMessages,
  fetchOrganizationNameById,
  insertAiMessages,
} from "@/lib/data/active-runtime-plane";
import { isPersistentDataBackendAvailable } from "@/lib/data/data-plane";
import { organizationIdSchema } from "@/lib/validation/schemas";
import { logOperationalEvent } from "@/lib/observability/events";
import { getProvenanceForOrg } from "@/lib/connectors/provenance";
import { getOrganizationConnections } from "@/lib/integrations/store";

const aiAdvisorBodySchema = organizationIdSchema.extend({
  department: z
    .enum(["executive", "finance", "sales", "operations"])
    .optional(),
  message: z.string().max(2000).optional(),
  conversationId: z.string().uuid().optional(),
});

async function getOrganizationName(organizationId: string): Promise<string> {
  const name = await fetchOrganizationNameById(organizationId);
  return name ?? organizationId;
}

async function loadConversationHistory(
  conversationId: string | undefined,
  organizationId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  if (!conversationId) return [];
  return fetchAiConversationMessages(conversationId, organizationId);
}

async function saveConversation(
  organizationId: string,
  userId: string,
  conversationId: string | undefined,
  userMessage: string | undefined,
  assistantResponse: string
): Promise<string | undefined> {
  if (!isPersistentDataBackendAvailable() || !userMessage) return conversationId;

  let convId = conversationId;
  if (!convId) {
    convId =
      (await createAiConversation(organizationId, userId, userMessage.slice(0, 80))) ?? undefined;
  }

  if (!convId) return undefined;

  await insertAiMessages(convId, organizationId, [
    { role: "user", content: userMessage },
    {
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

    const [dashboard, organizationName, history, onboardingState, provenanceRecords, connections] =
      await Promise.all([
        getDashboardData(body.organizationId),
        getOrganizationName(body.organizationId),
        loadConversationHistory(body.conversationId, body.organizationId),
        getOnboardingState(body.organizationId),
        getProvenanceForOrg(body.organizationId),
        getOrganizationConnections(body.organizationId),
      ]);

    const connectedSources = connections
      .filter((c) => c.status === "connected")
      .map((c) => c.provider);

    const insights = await generateAdvisorInsights({
      organizationName,
      department: body.department,
      dashboard,
      onboardingProfile: onboardingState.profile,
      provenanceRecords: provenanceRecords.map((p) => ({
        source: p.source,
        sourceType: p.sourceType,
        connectorId: p.connectorId,
        fileName: p.fileName,
        period: p.periodEnd ?? p.periodStart,
        syncedAt: p.syncedAt,
        uploadedAt: p.uploadedAt,
        category: p.category,
        confidence: p.confidence,
      })),
      connectedSources,
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
