import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, isAnthropicConfigured } from "@/lib/ai/config";
import {
  getAtRiskKpis,
  getFinancialRiskSignals,
  getPriorityAlerts,
} from "@/lib/ai/kpi-risk";
import type { DashboardData } from "@/lib/data/dashboard";
import type { FieldProvenance } from "@/lib/imports/honesty";
import { isEmptyFinancialSnapshot } from "@/lib/imports/honesty";
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

function amountLine(
  label: string,
  amount: number,
  provenance: FieldProvenance | undefined,
  suffix = ""
): string {
  if (!provenance || provenance === "INSUFFICIENT_DATA") {
    return `- ${label}: INSUFFICIENT_DATA`;
  }
  return `- ${label}: $${amount.toLocaleString()}${suffix} (${provenance})`;
}

function numberLine(
  label: string,
  value: number,
  provenance: FieldProvenance | undefined
): string {
  if (!provenance || provenance === "INSUFFICIENT_DATA") {
    return `- ${label}: INSUFFICIENT_DATA`;
  }
  return `- ${label}: ${value} (${provenance})`;
}

export function buildAdvisorDataContext(context: AdvisorRequestContext): string {
  const { dashboard, organizationName } = context;
  const snap = dashboard.financialSnapshot;
  const provenance = dashboard.fieldProvenance;
  const atRiskKpis = getAtRiskKpis(dashboard.kpis);
  const financialSignals = getFinancialRiskSignals(snap, provenance);
  const priorityAlerts = getPriorityAlerts(dashboard.alerts);
  const workingCapital = computeWorkingCapital(snap);
  const cashUsable = provenance?.currentCash && provenance.currentCash !== "INSUFFICIENT_DATA";

  if (isEmptyFinancialSnapshot(snap) && dashboard.monthlyTrends.length === 0 && dashboard.kpis.length === 0) {
    return `Organization: ${organizationName}
Data source: ${dashboard.source}

Financial snapshot: INSUFFICIENT_DATA
No SOURCE-DERIVED cash, burn, revenue, or forecast has been imported for this tenant.
Do not invent financial values. Do not use another organization's numbers.
Do not treat $0 as CALCULATED cash, runway, profit, or burn.

Ask the founder to import a financial snapshot (current_cash, burn_rate, revenue_mtd) or connect a live source.

Monthly trends: none imported
KPI risks: none
Financial risk signals: none
Priority alerts: none`;
  }

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
          .map((t) => `- ${t.month}: revenue $${t.revenue}, expenses $${t.expenses}, cash $${t.cash} (SOURCE-DERIVED)`)
          .join("\n")
      : "- No monthly trend data imported yet";

  return `Organization: ${organizationName}
Data source: ${dashboard.source}

Financial snapshot (use labeled provenance only — never invent missing fields):
${amountLine("Current cash", snap.currentCash, provenance?.currentCash)}
${amountLine("Forecasted cash (13wk)", snap.forecastedCash, provenance?.forecastedCash)}
${amountLine("Revenue MTD", snap.revenueMTD, snap.revenueMTD === 0 ? "INSUFFICIENT_DATA" : "SOURCE-DERIVED")}
${amountLine("Revenue YTD", snap.revenueYTD, snap.revenueYTD === 0 ? "INSUFFICIENT_DATA" : "SOURCE-DERIVED")}
${amountLine("Gross profit", snap.grossProfit, snap.grossProfit === 0 ? "INSUFFICIENT_DATA" : "SOURCE-DERIVED")}
${amountLine("Net profit", snap.netProfit, snap.netProfit === 0 ? "INSUFFICIENT_DATA" : "SOURCE-DERIVED")}
${amountLine("Operating expenses", snap.operatingExpenses, snap.operatingExpenses === 0 ? "INSUFFICIENT_DATA" : "SOURCE-DERIVED")}
${amountLine("EBITDA", snap.ebitda, provenance?.ebitda)}
${numberLine("Runway (months)", snap.runway, provenance?.runway)}
${amountLine("AR", snap.accountsReceivable, snap.accountsReceivable === 0 ? "INSUFFICIENT_DATA" : "SOURCE-DERIVED")}
${amountLine("AP", snap.accountsPayable, snap.accountsPayable === 0 ? "INSUFFICIENT_DATA" : "SOURCE-DERIVED")}
${cashUsable ? `- Working capital: $${workingCapital.toLocaleString()} (CALCULATED)` : "- Working capital: INSUFFICIENT_DATA"}
${amountLine("Burn rate", snap.burnRate, provenance?.burnRate, "/mo")}

Monthly trends (SOURCE-DERIVED):
${trendLines}

KPI risks (CALCULATED from imported KPIs only):
${kpiLines}

Financial risk signals:
${financialLines}

Priority alerts:
${alertLines}`;
}

function buildAdvisorPrompt(context: AdvisorRequestContext): string {
  const dataContext = buildAdvisorDataContext(context);
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