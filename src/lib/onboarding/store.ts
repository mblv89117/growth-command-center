import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationProvider } from "@/lib/integrations/types";
import { progressForStep } from "./progress";
import type {
  OnboardingMessage,
  OnboardingProfile,
  OnboardingSoftwareStack,
  OnboardingState,
  OnboardingStep,
  ToolExecutionResult,
} from "./types";

const REQUIRED_KPI_KEYS = [
  "revenue_goal",
  "gross_margin_target",
  "cash_runway_target",
  "headcount_goal",
] as const;

const KPI_DEFINITIONS: Record<
  (typeof REQUIRED_KPI_KEYS)[number],
  { name: string; unit: string }
> = {
  revenue_goal: { name: "Revenue Goal", unit: "currency" },
  gross_margin_target: { name: "Gross Margin Target", unit: "percent" },
  cash_runway_target: { name: "Cash Runway Target", unit: "number" },
  headcount_goal: { name: "Headcount Goal", unit: "number" },
};

const SOFTWARE_KEYS = ["accounting", "crm", "payroll", "marketing"] as const;

const CATEGORY_PROVIDER: Record<string, IntegrationProvider> = {
  accounting: "quickbooks",
  crm: "hubspot",
  payroll: "gusto",
  marketing: "google_sheets",
};

const memoryMessages = new Map<string, OnboardingMessage[]>();
const memoryProfiles = new Map<string, OnboardingProfile>();
const memoryKpiTargets = new Map<string, Set<string>>();

function defaultProfile(companyName: string): OnboardingProfile {
  return {
    companyName,
    industry: undefined,
    companySize: undefined,
    software: {},
    priorities: [],
    onboardingStep: "welcome",
    onboardingComplete: false,
  };
}

function mapOrgRow(row: Record<string, unknown>): OnboardingProfile {
  return {
    companyName: (row.name as string) ?? "Your Company",
    industry: (row.industry as string | null) ?? undefined,
    companySize: (row.company_size as string | null) ?? undefined,
    software: ((row.collected_software as OnboardingSoftwareStack | null) ?? {}) as OnboardingSoftwareStack,
    priorities: Array.isArray(row.business_priorities)
      ? (row.business_priorities as string[])
      : [],
    onboardingStep: ((row.onboarding_step as OnboardingStep | null) ?? "welcome") as OnboardingStep,
    onboardingComplete: Boolean(row.onboarding_complete),
  };
}

export async function getOnboardingState(organizationId: string): Promise<OnboardingState> {
  const admin = createAdminClient();

  if (admin) {
    const [{ data: org }, { data: messages }] = await Promise.all([
      admin.from("gcc_organizations").select("*").eq("id", organizationId).maybeSingle(),
      admin
        .from("gcc_onboarding_messages")
        .select("id, role, content, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
    ]);

    const profile = org ? mapOrgRow(org) : defaultProfile(organizationId);
    const mappedMessages: OnboardingMessage[] = (messages ?? []).map((row) => ({
      id: row.id as string,
      role: row.role as OnboardingMessage["role"],
      content: row.content as string,
      createdAt: row.created_at as string,
    }));

    return {
      organizationId,
      profile,
      messages: mappedMessages,
      progress: progressForStep(profile.onboardingStep),
    };
  }

  const profile = memoryProfiles.get(organizationId) ?? defaultProfile(organizationId);
  return {
    organizationId,
    profile,
    messages: memoryMessages.get(organizationId) ?? [],
    progress: progressForStep(profile.onboardingStep),
  };
}

export async function appendOnboardingMessage(
  organizationId: string,
  role: OnboardingMessage["role"],
  content: string
): Promise<OnboardingMessage> {
  const admin = createAdminClient();
  const message: OnboardingMessage = {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };

  if (admin) {
    const { data, error } = await admin
      .from("gcc_onboarding_messages")
      .insert({
        organization_id: organizationId,
        role,
        content,
      })
      .select("id, role, content, created_at")
      .single();

    if (!error && data) {
      return {
        id: data.id as string,
        role: data.role as OnboardingMessage["role"],
        content: data.content as string,
        createdAt: data.created_at as string,
      };
    }
  }

  const existing = memoryMessages.get(organizationId) ?? [];
  existing.push(message);
  memoryMessages.set(organizationId, existing);
  return message;
}

async function updateOrganization(
  organizationId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_organizations").update(patch).eq("id", organizationId);
    return;
  }

  const profile = memoryProfiles.get(organizationId) ?? defaultProfile(organizationId);
  if (patch.name) profile.companyName = patch.name as string;
  if (patch.industry) profile.industry = patch.industry as string;
  if (patch.company_size) profile.companySize = patch.company_size as string;
  if (patch.business_priorities) profile.priorities = patch.business_priorities as string[];
  if (patch.collected_software) profile.software = patch.collected_software as OnboardingSoftwareStack;
  if (patch.onboarding_step) profile.onboardingStep = patch.onboarding_step as OnboardingStep;
  if (typeof patch.onboarding_complete === "boolean") {
    profile.onboardingComplete = patch.onboarding_complete;
  }
  memoryProfiles.set(organizationId, profile);
}

async function getProfile(organizationId: string): Promise<OnboardingProfile> {
  const state = await getOnboardingState(organizationId);
  return state.profile;
}

function missingRequirements(profile: OnboardingProfile, kpiTargets: string[]): string[] {
  const missing: string[] = [];
  if (!profile.companyName?.trim()) missing.push("company name");
  if (!profile.industry?.trim()) missing.push("industry");
  if (!profile.companySize?.trim()) missing.push("company size");
  for (const key of SOFTWARE_KEYS) {
    if (!profile.software[key]?.trim()) missing.push(`${key} software`);
  }
  if (profile.priorities.length < 3) missing.push("3 business priorities");
  for (const key of REQUIRED_KPI_KEYS) {
    if (!kpiTargets.includes(key)) missing.push(`${key.replace(/_/g, " ")} target`);
  }
  return missing;
}

async function getConfiguredKpiKeys(organizationId: string): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin) {
    return [...(memoryKpiTargets.get(organizationId) ?? new Set<string>())];
  }

  const { data } = await admin
    .from("gcc_kpis")
    .select("kpi_key, target")
    .eq("organization_id", organizationId)
    .in("kpi_key", [...REQUIRED_KPI_KEYS]);

  return (data ?? [])
    .filter((row) => row.target != null)
    .map((row) => row.kpi_key as string);
}

export async function executeOnboardingTool(
  organizationId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "save_company_info":
      return saveCompanyInfo(organizationId, input);
    case "save_software_stack":
      return saveSoftwareStack(organizationId, input);
    case "save_business_priorities":
      return saveBusinessPriorities(organizationId, input);
    case "set_metric_target":
      return setMetricTarget(organizationId, input);
    case "connect_integration":
      return connectIntegrationIntent(organizationId, input);
    case "complete_onboarding":
      return completeOnboarding(organizationId);
    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

async function saveCompanyInfo(
  organizationId: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const companyName = String(input.companyName ?? "").trim();
  const industry = String(input.industry ?? "").trim();
  const companySize = String(input.companySize ?? "").trim();

  if (!companyName || !industry || !companySize) {
    return { success: false, message: "companyName, industry, and companySize are required." };
  }

  await updateOrganization(organizationId, {
    name: companyName,
    industry,
    company_size: companySize,
    onboarding_step: "software",
  });

  return {
    success: true,
    message: "Company profile saved.",
    onboardingStep: "software",
  };
}

async function saveSoftwareStack(
  organizationId: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const software: OnboardingSoftwareStack = {
    accounting: String(input.accounting ?? "").trim(),
    crm: String(input.crm ?? "").trim(),
    payroll: String(input.payroll ?? "").trim(),
    marketing: String(input.marketing ?? "").trim(),
  };

  if (Object.values(software).some((value) => !value)) {
    return {
      success: false,
      message: "accounting, crm, payroll, and marketing fields are required (use 'none' if not used).",
    };
  }

  await updateOrganization(organizationId, {
    collected_software: software,
    onboarding_step: "priorities",
  });

  return {
    success: true,
    message: "Software stack saved.",
    onboardingStep: "priorities",
  };
}

async function saveBusinessPriorities(
  organizationId: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const priorities = Array.isArray(input.priorities)
    ? input.priorities.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (priorities.length < 3) {
    return { success: false, message: "Provide at least 3 business priorities." };
  }

  await updateOrganization(organizationId, {
    business_priorities: priorities.slice(0, 5),
    onboarding_step: "kpis",
  });

  return {
    success: true,
    message: "Business priorities saved.",
    onboardingStep: "kpis",
  };
}

async function setMetricTarget(
  organizationId: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const metricKey = String(input.metricKey ?? "").trim();
  const targetValue = Number(input.targetValue);

  if (!metricKey || Number.isNaN(targetValue)) {
    return { success: false, message: "metricKey and numeric targetValue are required." };
  }

  if (!(metricKey in KPI_DEFINITIONS)) {
    return {
      success: false,
      message: `metricKey must be one of: ${REQUIRED_KPI_KEYS.join(", ")}`,
    };
  }

  const definition = KPI_DEFINITIONS[metricKey as keyof typeof KPI_DEFINITIONS];
  const admin = createAdminClient();

  if (admin) {
    await admin.from("gcc_kpis").upsert(
      {
        organization_id: organizationId,
        kpi_key: metricKey,
        name: definition.name,
        value: 0,
        unit: definition.unit,
        change: 0,
        target: targetValue,
      },
      { onConflict: "organization_id,kpi_key" }
    );
  } else {
    const targets = memoryKpiTargets.get(organizationId) ?? new Set<string>();
    targets.add(metricKey);
    memoryKpiTargets.set(organizationId, targets);
  }

  const configured = await getConfiguredKpiKeys(organizationId);
  if (!configured.includes(metricKey)) configured.push(metricKey);

  const onboardingStep: OnboardingStep =
    configured.length >= REQUIRED_KPI_KEYS.length ? "complete" : "kpis";

  await updateOrganization(organizationId, { onboarding_step: onboardingStep });

  return {
    success: true,
    message: `${definition.name} target saved.`,
    onboardingStep,
  };
}

async function connectIntegrationIntent(
  organizationId: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const category = String(input.category ?? "").trim().toLowerCase();
  const softwareName = String(input.softwareName ?? "").trim();
  const provider = (CATEGORY_PROVIDER[category] ?? "quickbooks") as IntegrationProvider;

  if (!category || !softwareName) {
    return { success: false, message: "category and softwareName are required." };
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("gcc_integration_connections").upsert(
      {
        organization_id: organizationId,
        provider,
        status: "pending",
        metadata: {
          onboarding_intent: true,
          category,
          software_name: softwareName,
        },
      },
      { onConflict: "organization_id,provider" }
    );
  }

  return {
    success: true,
    message: "We’ll connect this integration in the next step.",
  };
}

async function completeOnboarding(organizationId: string): Promise<ToolExecutionResult> {
  const profile = await getProfile(organizationId);
  const kpiTargets = await getConfiguredKpiKeys(organizationId);
  const missing = missingRequirements(profile, kpiTargets);

  if (missing.length > 0) {
    return {
      success: false,
      message: `Onboarding is not complete yet. Missing: ${missing.join(", ")}.`,
    };
  }

  await updateOrganization(organizationId, {
    onboarding_complete: true,
    onboarding_step: "complete",
  });

  return {
    success: true,
    message: "Onboarding complete. You can go to your dashboard.",
    onboardingStep: "complete",
    onboardingComplete: true,
  };
}
