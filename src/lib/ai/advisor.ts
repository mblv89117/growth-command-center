import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, isAnthropicConfigured } from "@/lib/ai/config";
import {
  getAtRiskKpis,
  getFinancialRiskSignals,
  getPriorityAlerts,
} from "@/lib/ai/kpi-risk";
import type { DashboardData } from "@/lib/data/dashboard";
import { computeWorkingCapital } from "@/lib/financial/deltas";
import { ServiceUnavailableError } from "@/lib/api/errors";

const ADVISOR_MODEL = "claude-sonnet-4-6";

export interface AdvisorRequestContext {
  organizationName: string;
  department?: string;
  dashboard: DashboardData;
  userMessage?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

function buildDataContext(context: AdvisorRequestContext): string {
  const { dashboard, organizationName } = context;
  const atRiskKpis = getAtRiskKpis(dashboard.kpis);
  const financialSignals = getFinancialRiskSignals(dashboard.financialSnapshot);
  const priorityAlerts = getPriorityAlerts(dashboard.alerts);
  const workingCapital = computeWorkingCapital(dashboard.financialSnapshot);

  const kpiLines =
    atRiskKpis.length > 0
      ? atRiskKpis.map((item) => `- [${item.level.toUpperCase()}] ${item.reason}`).join("\n")
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

  const trendLines =
    dashboard.monthlyTrends.length > 0
      ? dashboard.monthlyTrends
          .slice(-3)
          .map((t) => `- ${t.month}: revenue $${t.revenue}, expenses $${t.expenses}, cash $${t.cash}`)
          .join("\n")
      : "- No monthly trend data imported yet";

  return `Organization: ${organizationName}
Data source: ${dashboard.source}

CALCULATED financial snapshot:
- Current cash: $${dashboard.financialSnapshot.currentCash.toLocaleString()}
- Forecasted cash (13wk): $${dashboard.financialSnapshot.forecastedCash.toLocaleString()}
- Revenue MTD: $${dashboard.financialSnapshot.revenueMTD.toLocaleString()}
- Revenue YTD: $${dashboard.financialSnapshot.revenueYTD.toLocaleString()}
- Gross profit: $${dashboard.financialSnapshot.grossProfit.toLocaleString()}
- Net profit: $${dashboard.financialSnapshot.netProfit.toLocaleString()}
- Operating expenses: $${dashboard.financialSnapshot.operatingExpenses.toLocaleString()}
- EBITDA: $${dashboard.financialSnapshot.ebitda.toLocaleString()}
- Runway (months): ${dashboard.financialSnapshot.runway}
- AR: $${dashboard.financialSnapshot.accountsReceivable.toLocaleString()}
- AP: $${dashboard.financialSnapshot.accountsPayable.toLocaleString()}
- Working capital: $${workingCapital.toLocaleString()}
- Burn rate: $${dashboard.financialSnapshot.burnRate.toLocaleString()}/mo

Monthly trends (SOURCE-DERIVED):
${trendLines}

KPI risks (CALCULATED):
${kpiLines}

Financial risk signals:
${financialLines}

Priority alerts:
${alertLines}`;
}

function buildAdvisorPrompt(context: AdvisorRequestContext): string {
  const dataContext = buildDataContext(context);
  const userQuestion = context.userMessage?.trim();

  if (userQuestion) {
    return `You are an AI CFO advisor. Answer the founder's question using ONLY the tenant data below.

Rules:
- Use CALCULATED and SOURCE-DERIVED numbers only — never invent financial facts
- If data is insufficient, say what is missing and what to import/connect
- Label any inference as AI-INFERRED
- Be concise, plain-language, actionable (under 250 words)
- Do not mention you are an AI or reference internal systems

${dataContext}

Founder question: ${userQuestion}`;
  }

  return `You are an executive CFO advisor.

Use ONLY the tenant metrics below. Provide 4-5 concise executive insights under 200 words total.
Prioritize red/yellow KPI risk, cash risk, revenue risk, margin risk, and immediate next actions.
Use short bullet points. Do not mention API keys, internal systems, or that you are an AI.

${dataContext}`;
}

export async function generateAdvisorInsights(context: AdvisorRequestContext): Promise<string> {
  if (!isAnthropicConfigured()) {
    throw new ServiceUnavailableError(
      "AI Advisor is not configured. Set ANTHROPIC_API_KEY on the server."
    );
  }

  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const systemPrompt = buildAdvisorPrompt(context);

  const messages: Anthropic.MessageParam[] = [];
  if (context.conversationHistory) {
    for (const msg of context.conversationHistory.slice(-6)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: systemPrompt });

  try {
    const response = await client.messages.create({
      model: ADVISOR_MODEL,
      max_tokens: 600,
      messages,
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