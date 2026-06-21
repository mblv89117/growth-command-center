import { z } from "zod";
import { NextResponse } from "next/server";
import { runOnboardingChat } from "@/lib/ai/onboarding";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireSecureTenantRequest } from "@/lib/api/secure-access";
import { AI_ONBOARD_RATE_LIMIT } from "@/lib/rate-limit";
import { organizationIdSchema } from "@/lib/validation/schemas";

const aiOnboardBodySchema = organizationIdSchema.extend({
  message: z.string().max(4000).optional(),
});

export async function POST(request: Request) {
  try {
    const { body } = await requireSecureTenantRequest({
      request,
      schema: aiOnboardBodySchema,
      rateLimit: {
        route: "ai-onboard",
        ...AI_ONBOARD_RATE_LIMIT,
      },
    });

    const result = await runOnboardingChat(body.organizationId, body.message);

    return NextResponse.json({
      reply: result.reply,
      organizationId: body.organizationId,
      onboardingComplete: result.state.profile.onboardingComplete,
      onboardingStep: result.state.profile.onboardingStep,
      progress: result.state.progress,
      messages: result.state.messages,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
