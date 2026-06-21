import { PageHeader } from "@/components/shared";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";

export default function OnboardingPage() {
  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Guided setup for your company profile, priorities, software stack, and KPI targets"
      />
      <OnboardingChat />
    </div>
  );
}
