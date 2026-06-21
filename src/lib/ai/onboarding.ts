import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, isAnthropicConfigured } from "@/lib/ai/config";
import { ServiceUnavailableError } from "@/lib/api/errors";
import { progressForStep } from "@/lib/onboarding/progress";
import {
  appendOnboardingMessage,
  executeOnboardingTool,
  getOnboardingState,
} from "@/lib/onboarding/store";
import type { OnboardingState } from "@/lib/onboarding/types";

const ONBOARDING_MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 6;

const ONBOARDING_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_company_info",
    description: "Save company name, industry, and employee size.",
    input_schema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        industry: { type: "string" },
        companySize: { type: "string", description: "Employee size band, e.g. 1-10" },
      },
      required: ["companyName", "industry", "companySize"],
    },
  },
  {
    name: "save_software_stack",
    description: "Save software used for accounting, CRM/sales, payroll/HR, and marketing.",
    input_schema: {
      type: "object",
      properties: {
        accounting: { type: "string" },
        crm: { type: "string" },
        payroll: { type: "string" },
        marketing: { type: "string" },
      },
      required: ["accounting", "crm", "payroll", "marketing"],
    },
  },
  {
    name: "save_business_priorities",
    description: "Save the top business priorities for the next 12 months.",
    input_schema: {
      type: "object",
      properties: {
        priorities: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
        },
      },
      required: ["priorities"],
    },
  },
  {
    name: "set_metric_target",
    description: "Save a KPI target value.",
    input_schema: {
      type: "object",
      properties: {
        metricKey: {
          type: "string",
          enum: [
            "revenue_goal",
            "gross_margin_target",
            "cash_runway_target",
            "headcount_goal",
          ],
        },
        targetValue: { type: "number" },
      },
      required: ["metricKey", "targetValue"],
    },
  },
  {
    name: "connect_integration",
    description: "Record a pending integration intent during onboarding (Merge.dev comes later).",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["accounting", "crm", "payroll", "marketing"],
        },
        softwareName: { type: "string" },
      },
      required: ["category", "softwareName"],
    },
  },
  {
    name: "complete_onboarding",
    description: "Mark onboarding complete after all required data is collected.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

function buildSystemPrompt(state: OnboardingState): string {
  return `You are Growth Command Center's onboarding guide for ${state.profile.companyName}.
Current step: ${state.profile.onboardingStep}.
Progress: ${state.progress}%.

Collect setup information in a friendly executive tone. Ask one or two concise questions at a time.
Required flow:
1. Company name, industry, employee size -> save_company_info
2. Software for accounting, CRM/sales, payroll/HR, marketing -> save_software_stack
3. Top 3 business priorities for next 12 months -> save_business_priorities
4. KPI targets: revenue goal, gross margin target, cash runway target (months), headcount goal -> set_metric_target
5. If user mentions connecting software now, use connect_integration (pending only)
6. When everything required is saved, call complete_onboarding

Use tools whenever you have enough structured data. Do not invent saved data.
Do not mention API keys or that you are an AI. Keep replies short.`;
}

function toAnthropicMessages(state: OnboardingState, userMessage?: string) {
  const messages: Anthropic.MessageParam[] = state.messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
  }));

  if (userMessage?.trim()) {
    messages.push({ role: "user", content: userMessage.trim() });
  } else if (messages.length === 0) {
    messages.push({
      role: "user",
      content: "Please start onboarding and greet me briefly.",
    });
  }

  return messages;
}

export interface OnboardingChatResult {
  reply: string;
  state: OnboardingState;
}

export async function runOnboardingChat(
  organizationId: string,
  userMessage?: string
): Promise<OnboardingChatResult> {
  if (!isAnthropicConfigured()) {
    throw new ServiceUnavailableError(
      "AI Onboarding is not configured. Set ANTHROPIC_API_KEY on the server."
    );
  }

  const initialState = await getOnboardingState(organizationId);
  if (initialState.profile.onboardingComplete) {
    return {
      reply: "Your onboarding is already complete. Head to the dashboard when you're ready.",
      state: initialState,
    };
  }

  if (userMessage?.trim()) {
    await appendOnboardingMessage(organizationId, "user", userMessage.trim());
  }

  const state = await getOnboardingState(organizationId);
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  let messages = toAnthropicMessages(state, userMessage);
  let reply = "";

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await client.messages.create({
        model: ONBOARDING_MODEL,
        max_tokens: 900,
        system: buildSystemPrompt(state),
        tools: ONBOARDING_TOOLS,
        messages,
      });

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      const textBlocks = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (toolUses.length === 0) {
        reply = textBlocks || "Thanks — let's keep going with your setup.";
        break;
      }

      messages = [...messages, { role: "assistant", content: response.content }];
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        if (toolUse.type !== "tool_use") continue;
        const result = await executeOnboardingTool(
          organizationId,
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.message,
        });
      }

      messages.push({ role: "user", content: toolResults });

      if (textBlocks) reply = textBlocks;
    }

    if (!reply) {
      reply = "Thanks — I saved your details. Let's continue setup.";
    }
  } catch (error) {
    if (error instanceof ServiceUnavailableError) throw error;
    throw new ServiceUnavailableError("AI Onboarding is temporarily unavailable");
  }

  await appendOnboardingMessage(organizationId, "assistant", reply);
  const finalState = await getOnboardingState(organizationId);

  return {
    reply,
    state: {
      ...finalState,
      progress: progressForStep(finalState.profile.onboardingStep),
    },
  };
}
