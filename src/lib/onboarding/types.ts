export type OnboardingStep =
  | "welcome"
  | "company"
  | "software"
  | "priorities"
  | "kpis"
  | "complete";

export type OnboardingMessageRole = "user" | "assistant" | "system";

export interface OnboardingMessage {
  id: string;
  role: OnboardingMessageRole;
  content: string;
  createdAt: string;
}

export interface OnboardingSoftwareStack {
  accounting?: string;
  crm?: string;
  payroll?: string;
  marketing?: string;
}

export interface OnboardingProfile {
  companyName: string;
  industry?: string;
  companySize?: string;
  software: OnboardingSoftwareStack;
  priorities: string[];
  onboardingStep: OnboardingStep;
  onboardingComplete: boolean;
}

export interface OnboardingState {
  organizationId: string;
  profile: OnboardingProfile;
  messages: OnboardingMessage[];
  progress: number;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  onboardingStep?: OnboardingStep;
  onboardingComplete?: boolean;
}
