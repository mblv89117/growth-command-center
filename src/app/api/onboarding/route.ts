import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth/access";
import { authErrorResponse } from "@/lib/auth/api";
import { getOnboardingState } from "@/lib/onboarding/store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    await requireApiAccess({ organizationId });
    const state = await getOnboardingState(organizationId);

    return NextResponse.json({
      organizationId,
      onboardingComplete: state.profile.onboardingComplete,
      onboardingStep: state.profile.onboardingStep,
      progress: state.progress,
      profile: state.profile,
      messages: state.messages,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
