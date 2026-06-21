import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, isAnthropicConfigured } from "@/lib/ai/config";
import {
  getAtRiskKpis,
  getFinancialRiskSignals,
  getPriorityAlerts,
} from "@/lib/ai/kpi-risk";
import type { DashboardData } from "@/lib/data/dashboard";
import { ServiceUnavailableError } from "@/lib/api/errors";

const ADVISOR_MODEL = "claude-sonnet-4-6";

export interface AdvisorRequestContext {
  organizationName: string;
  department?: string;
  dashboard: DashboardData;
}

function buildAdvisorPrompt(context: AdvisorRequestContext): string {
  const { dashboard, organizationName, department } = context;
  const atRiskKpis = getAtRiskKpis(dashboard.kpis);
  const financialSignals = getFinancialRiskSignals(dashboard.financialSnapshot);
  const priorityAlerts = getPriorityAlerts(dashboard.alerts);

  const kpiLines =
    atRiskKpis.length > 0
      ? atRiskKpis
          .map((item) => `- [${item.level.toUpperCase()}] ${item.reason}`)
          .join("\n")
      : "- No KPI targets flagged as red/yellow";

  const alertLines =
    priorityAlerts.length > 0
      ? priorityAlerts
          .slice(0, 5)
          .map((alert) => `- ${alert.severity.toUpperCase()}: ${alert.title} — ${alert.recommendedAction}`)
          .join("\n")
      : "- No open critical/high alerts";

  const financialLines =
    financialSignals.length > 0
      ? financialSignals.map((signal) => `- ${signal}`).join("\n")
      : "- No major cash/margin/revenue risk signals from snapshot";

  return `You are an executive CFO advisor for ${organizationName}.
Department focus: ${department ?? "executive"}.

Use ONLY the tenant metrics below. Provide 4-5 concise executive insights under 200 words total.
Prioritize red/yellow KPI risk, cash risk, revenue risk, margin risk, and immediate next actions.
Use short bullet points. Do not mention API keys, internal systems, or that you are an AI.

Financial snapshot:
- Current cash: ${dashboard.financialSnapshot.currentCash}
- Forecasted cash (13wk): ${dashboard.financialSnapshot.forecastedCash}
- Revenue MTD: ${dashboard.financialSnapshot.revenueMTD}
- Revenue YTD: ${dashboard.financialSnapshot.revenueYTD}
- Gross profit: ${dashboard.financialSnapshot.grossProfit}
- Net profit: ${dashboard.financialSnapshot.netProfit}
- Runway (months): ${dashboard.financialSnapshot.runway}
- AR: ${dashboard.financialSnapshot.accountsReceivable}
- AP: ${dashboard.financialSnapshot.accountsPayable}
- Burn rate: ${dashboard.financialSnapshot.burnRate}

KPI risks:
${kpiLines}

Financial risk signals:
${financialLines}

Priority alerts:
${alertLines}`;
}

export async function generateAdvisorInsights(context: AdvisorRequestContext): Promise<string> {
  if (!isAnthropicConfigured()) {
    throw new ServiceUnavailableError(
      "AI Advisor is not configured. Set ANTHROPIC_API_KEY on the server."
    );
  }

  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const prompt = buildAdvisorPrompt(context);

  try {
    const response = await client.messages.create({
      model: ADVISOR_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("AI Advisor returned an empty response");
    }

    return text;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) throw error;
    throw new ServiceUnavailableError("AI Advisor is temporarily unavailable");
  }
}
