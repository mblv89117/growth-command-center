import type { Alert, FinancialSnapshot, KPI, MonthlyTrend } from "@/lib/types";
import { computeWorkingCapital } from "@/lib/financial/deltas";

export type EvidenceConfidence = "VERIFIED" | "ESTIMATED" | "INFERRED";

export interface ValueCreationOpportunity {
  id: string;
  category:
    | "margin"
    | "working_capital"
    | "concentration"
    | "cost_structure"
    | "forecast_risk"
    | "growth"
    | "scalability";
  finding: string;
  evidence: string;
  businessImpact: string;
  recommendedAction: string;
  confidence: EvidenceConfidence;
  financialImpact: number;
  priority: "high" | "medium" | "low";
}

export interface ValueCreationBoard {
  organizationId: string;
  opportunities: ValueCreationOpportunity[];
  verifiedImpact: number;
  estimatedImpact: number;
  summary: string;
}

export function analyzeValueCreation(input: {
  organizationId: string;
  snapshot: FinancialSnapshot;
  trends: MonthlyTrend[];
  kpis: KPI[];
  alerts: Alert[];
}): ValueCreationBoard {
  const opportunities: ValueCreationOpportunity[] = [];
  const { snapshot, trends, kpis, alerts } = input;

  const grossMarginKpi = kpis.find((k) => k.id === "gross_margin" || k.name.toLowerCase().includes("gross margin"));
  const arDaysKpi = kpis.find((k) => k.id === "ar_days" || k.name.toLowerCase().includes("ar days"));
  const workingCapital = computeWorkingCapital(snapshot);

  if (grossMarginKpi && grossMarginKpi.target && grossMarginKpi.value < grossMarginKpi.target) {
    const gap = grossMarginKpi.target - grossMarginKpi.value;
    const impact = Math.round(snapshot.revenueMTD * (gap / 100));
    opportunities.push({
      id: "margin-recovery",
      category: "margin",
      finding: `Gross margin is ${grossMarginKpi.value}% vs ${grossMarginKpi.target}% target`,
      evidence: `CALCULATED from revenue MTD $${snapshot.revenueMTD.toLocaleString()} and gross profit $${snapshot.grossProfit.toLocaleString()}`,
      businessImpact: `Closing the margin gap could recover ~$${impact.toLocaleString()} monthly`,
      recommendedAction: "Review job costing, pricing, and subcontractor rates on lowest-margin work",
      confidence: "VERIFIED",
      financialImpact: impact,
      priority: gap > 5 ? "high" : "medium",
    });
  }

  if (arDaysKpi && arDaysKpi.target && arDaysKpi.value > arDaysKpi.target) {
    const excessDays = arDaysKpi.value - arDaysKpi.target;
    const dailyRevenue = snapshot.revenueMTD / 30;
    const impact = Math.round(excessDays * dailyRevenue * 0.5);
    opportunities.push({
      id: "ar-collections",
      category: "working_capital",
      finding: `AR days at ${arDaysKpi.value} vs ${arDaysKpi.target}-day target`,
      evidence: `CALCULATED: AR balance $${snapshot.accountsReceivable.toLocaleString()}, ${excessDays} excess days`,
      businessImpact: `Accelerating collections could free ~$${impact.toLocaleString()} in cash`,
      recommendedAction: "Implement weekly AR aging review and early-pay incentives for top overdue accounts",
      confidence: "VERIFIED",
      financialImpact: impact,
      priority: "high",
    });
  }

  if (snapshot.accountsPayable > snapshot.accountsReceivable * 0.8 && snapshot.accountsReceivable > 0) {
    opportunities.push({
      id: "ap-optimization",
      category: "working_capital",
      finding: "AP balance is high relative to AR — working capital pressure",
      evidence: `SOURCE-DERIVED: AP $${snapshot.accountsPayable.toLocaleString()} vs AR $${snapshot.accountsReceivable.toLocaleString()}`,
      businessImpact: `Working capital position: $${workingCapital.toLocaleString()}`,
      recommendedAction: "Negotiate extended payment terms while accelerating receivables",
      confidence: "ESTIMATED",
      financialImpact: Math.round(snapshot.accountsPayable * 0.1),
      priority: "medium",
    });
  }

  if (snapshot.runway < 6 && snapshot.runway > 0) {
    opportunities.push({
      id: "runway-risk",
      category: "forecast_risk",
      finding: `Cash runway at ${snapshot.runway} months — below 6-month safety threshold`,
      evidence: `CALCULATED: current cash $${snapshot.currentCash.toLocaleString()}, burn $${snapshot.burnRate.toLocaleString()}/mo`,
      businessImpact: "Limited buffer for unexpected expenses or revenue delays",
      recommendedAction: "Review discretionary spend, accelerate collections, and model downside scenarios",
      confidence: "VERIFIED",
      financialImpact: 0,
      priority: "high",
    });
  }

  if (trends.length >= 3) {
    const recent = trends.slice(-3);
    const revenueDeclining = recent[2].revenue < recent[0].revenue * 0.9;
    if (revenueDeclining) {
      opportunities.push({
        id: "revenue-decline",
        category: "growth",
        finding: "Revenue trend declining over last 3 months",
        evidence: `CALCULATED from SOURCE-DERIVED monthly trends (latest < 90% of first of last 3): ${recent.map((t) => `${t.month}: $${t.revenue.toLocaleString()}`).join(" → ")}`,
        businessImpact: "Revenue softness compresses margin and cash generation",
        recommendedAction: "Diagnose pipeline conversion, customer retention, and pricing",
        confidence: "VERIFIED",
        financialImpact: Math.round((recent[0].revenue - recent[2].revenue)),
        priority: "high",
      });
    }
  }

  const criticalAlerts = alerts.filter((a) => !a.isRead && (a.severity === "critical" || a.severity === "high"));
  for (const alert of criticalAlerts.slice(0, 2)) {
    opportunities.push({
      id: `alert-${alert.id}`,
      category: "forecast_risk",
      finding: alert.title,
      evidence: `SOURCE-DERIVED alert: ${alert.description}`,
      businessImpact: alert.affectedMetric,
      recommendedAction: alert.recommendedAction,
      confidence: "VERIFIED",
      financialImpact: 0,
      priority: alert.severity === "critical" ? "high" : "medium",
    });
  }

  if (snapshot.operatingExpenses > snapshot.revenueMTD * 0.35 && snapshot.revenueMTD > 0) {
    opportunities.push({
      id: "opex-efficiency",
      category: "cost_structure",
      finding: "Operating expenses exceed 35% of revenue",
      evidence: `CALCULATED: OpEx $${snapshot.operatingExpenses.toLocaleString()} / Revenue $${snapshot.revenueMTD.toLocaleString()}`,
      businessImpact: "High fixed cost base reduces operating leverage",
      recommendedAction: "Benchmark OpEx categories and identify 5-10% reduction targets",
      confidence: "ESTIMATED",
      financialImpact: Math.round(snapshot.operatingExpenses * 0.05),
      priority: "medium",
    });
  }

  const verifiedImpact = opportunities
    .filter((o) => o.confidence === "VERIFIED" && o.financialImpact > 0)
    .reduce((s, o) => s + o.financialImpact, 0);
  const estimatedImpact = opportunities
    .filter((o) => o.confidence === "ESTIMATED" && o.financialImpact > 0)
    .reduce((s, o) => s + o.financialImpact, 0);

  return {
    organizationId: input.organizationId,
    opportunities: opportunities.sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority)),
    verifiedImpact,
    estimatedImpact,
    summary:
      opportunities.length === 0
        ? "Import or connect financial data to surface value-creation opportunities."
        : `Found ${opportunities.length} opportunities with $${verifiedImpact.toLocaleString()} verified and $${estimatedImpact.toLocaleString()} estimated impact.`,
  };
}

function priorityScore(p: ValueCreationOpportunity["priority"]): number {
  return p === "high" ? 3 : p === "medium" ? 2 : 1;
}
