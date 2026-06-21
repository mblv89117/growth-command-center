import type { OnboardingStep } from "./types";

const STEP_PROGRESS: Record<OnboardingStep, number> = {
  welcome: 5,
  company: 25,
  software: 45,
  priorities: 65,
  kpis: 85,
  complete: 100,
};

export function progressForStep(step: OnboardingStep): number {
  return STEP_PROGRESS[step] ?? 0;
}

export function nextStep(current: OnboardingStep): OnboardingStep {
  const order: OnboardingStep[] = [
    "welcome",
    "company",
    "software",
    "priorities",
    "kpis",
    "complete",
  ];
  const index = order.indexOf(current);
  if (index === -1 || index === order.length - 1) return "complete";
  return order[index + 1];
}

export function stepLabel(step: OnboardingStep): string {
  switch (step) {
    case "welcome":
      return "Welcome";
    case "company":
      return "Company profile";
    case "software":
      return "Software stack";
    case "priorities":
      return "Business priorities";
    case "kpis":
      return "KPI targets";
    case "complete":
      return "Complete";
    default:
      return "Onboarding";
  }
}
