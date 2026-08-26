import { isEmptyFinancialSnapshot } from "@/lib/imports/honesty";
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
  const { snapshot, trends, kpis, alerts } = input;

  if (isEmptyFinancialSnapshot(snapshot) && trends.length === 0 && kpis.length === 0 && alerts.length === 0) {
    return {
      organizationId: input.organizationId,
      opportunities: [],
      verifiedImpact: 0,
      estimatedImpact: 0,
      summary: "Import or connect financial data to surface value-creation opportunities.",
    };
  }

  const opportunities: ValueCreationOpportunity[] = [];

  const grossMarginKpi = kpis.find((k) => k.id === "gross_margin" || k.name.toLowerCase().includes("gross margin"));
  const arDaysKpi = kpis.find((k) => k.id === "ar_days" || k.name.toLowerCase().includes("ar days"));
  const apDaysKpi = kpis.find((k) => k.id === "ap_days" || k.name.toLowerCase().includes("ap days"));
  const runwayKpi = kpis.find(
    (k) => k.id === "cash_runway" || k.name.toLowerCase().includes("runway")
  );
  const revenueGrowthKpi = kpis.find(
    (k) => k.id === "revenue_growth" || k.name.toLowerCase().includes("revenue growth")
  );
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

  if (apDaysKpi && apDaysKpi.target != null && apDaysKpi.value > apDaysKpi.target) {
    const excessDays = apDaysKpi.value - apDaysKpi.target;
    const dailyExpense = snapshot.operatingExpenses / 30;
    const impact = snapshot.operatingExpenses > 0 ? Math.round(excessDays * dailyExpense) : 0;
    opportunities.push({
      id: "ap-optimization",
      category: "working_capital",
      finding: `AP days at ${apDaysKpi.value} vs ${apDaysKpi.target}-day owner target`,
      evidence: `CALCULATED: AP $${snapshot.accountsPayable.toLocaleString()} vs owner AP-days target ${apDaysKpi.target}; working capital $${workingCapital.toLocaleString()}`,
      businessImpact: `AP days above the owner-set target ties ~$${impact.toLocaleString()} in payables timing`,
      recommendedAction: "Review payment terms against the owner AP-days target; do not invent an AP/AR ratio",
      confidence: "VERIFIED",
      financialImpact: impact,
      priority: excessDays > 10 ? "high" : "medium",
    });
  }

  if (
    runwayKpi &&
    runwayKpi.target != null &&
    snapshot.runway > 0 &&
    runwayKpi.value < runwayKpi.target
  ) {
    opportunities.push({
      id: "runway-risk",
      category: "forecast_risk",
      finding: `Cash runway at ${runwayKpi.value} months vs ${runwayKpi.target}-month owner target`,
      evidence: `CALCULATED: current cash $${snapshot.currentCash.toLocaleString()}, burn $${snapshot.burnRate.toLocaleString()}/mo = ${runwayKpi.value} vs owner target ${runwayKpi.target}`,
      businessImpact: "Runway is below the owner-set target buffer",
      recommendedAction: "Review discretionary spend against the owner runway target; do not invent a 6-month threshold",
      confidence: "VERIFIED",
      financialImpact: 0,
      priority: "high",
    });
  }

  if (
    revenueGrowthKpi &&
    revenueGrowthKpi.target != null &&
    revenueGrowthKpi.value < revenueGrowthKpi.target
  ) {
    const recent = trends.slice(-3);
    const trendEvidence =
      recent.length >= 2
        ? recent.map((t) => `${t.month}: $${t.revenue.toLocaleString()}`).join(" → ")
        : "owner revenue-growth KPI";
    const latest = recent.length ? recent[recent.length - 1]?.revenue ?? 0 : 0;
    const prior = recent.length >= 2 ? recent[recent.length - 2]?.revenue ?? 0 : 0;
    const impact =
      latest > 0 && prior > 0 ? Math.round(prior - latest) : 0;
    const gap = revenueGrowthKpi.target - revenueGrowthKpi.value;
    opportunities.push({
      id: "revenue-decline",
      category: "growth",
      finding: `Revenue growth is ${revenueGrowthKpi.value}% vs ${revenueGrowthKpi.target}% owner target`,
      evidence: `CALCULATED from SOURCE-DERIVED monthly trends vs owner target ${revenueGrowthKpi.target}%: ${trendEvidence}`,
      businessImpact: "Revenue growth below the owner-set target compresses margin and cash generation",
      recommendedAction: "Diagnose pipeline conversion against the owner growth target; do not invent a 90% decline rule",
      confidence: "VERIFIED",
      financialImpact: impact,
      priority: gap > 5 ? "high" : "medium",
    });
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

  const opexKpi = kpis.find(
    (k) =>
      k.id === "opex_ratio" ||
      k.name.toLowerCase().includes("opex") ||
      k.name.toLowerCase().includes("operating expense")
  );
  if (
    opexKpi &&
    opexKpi.target != null &&
    snapshot.revenueMTD > 0 &&
    opexKpi.value > opexKpi.target
  ) {
    const ratio =
      Math.round((snapshot.operatingExpenses / snapshot.revenueMTD) * 1000) / 10;
    const gap = opexKpi.value - opexKpi.target;
    const impact = Math.round(snapshot.revenueMTD * (gap / 100));
    opportunities.push({
      id: "opex-efficiency",
      category: "cost_structure",
      finding: `OpEx ratio is ${opexKpi.value}% vs ${opexKpi.target}% owner target`,
      evidence: `CALCULATED: OpEx $${snapshot.operatingExpenses.toLocaleString()} / Revenue $${snapshot.revenueMTD.toLocaleString()} = ${ratio}% vs owner target ${opexKpi.target}%`,
      businessImpact: "OpEx above the owner-set target reduces operating leverage",
      recommendedAction: "Review OpEx categories against the owner target; do not invent an industry ratio",
      confidence: "VERIFIED",
      financialImpact: impact,
      priority: gap > 5 ? "high" : "medium",
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
