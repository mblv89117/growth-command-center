/** Client Value Operating System — domain types (GCC-owned after engagement). */

export type EvidenceConfidence = "VERIFIED" | "ESTIMATED" | "INFERRED";

export type ExceptionKind =
  | "needs_attention"
  | "decision_required"
  | "at_risk"
  | "off_track"
  | "cash_risk"
  | "kpi_deterioration"
  | "data_missing"
  | "forecast_variance"
  | "opportunity"
  | "ready"
  | "outcome";

export type ExceptionSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ValueInitiativeStatus =
  | "proposed"
  | "active"
  | "on_track"
  | "at_risk"
  | "completed"
  | "verified";

export type SignalKind =
  | "high_realized_value"
  | "new_constraint"
  | "new_capital_need"
  | "new_ai_opportunity"
  | "new_process_bottleneck"
  | "contract_opportunity"
  | "financial_deterioration"
  | "low_engagement"
  | "renewal_risk"
  | "expansion_ready";

export type BriefApprovalStatus = "draft" | "pending_approval" | "approved" | "delivered";

/**
 * Versioned commercial context consumed from Atlas Active Client / Engagement handoff.
 * Canonical ownership: Platform Integration. GCC consumes; does not redefine.
 */
export type ClientContextContractVersion = "atlas-gcc-client-context.v1";

export interface ApprovedKpi {
  key: string;
  label: string;
  target: number;
  unit: "currency" | "percent" | "days" | "number";
  baseline?: number;
}

export interface NinetyDayPriority {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: "not_started" | "in_progress" | "blocked" | "done";
  rank: number;
}

export interface ClientCommercialContext {
  contractVersion: ClientContextContractVersion;
  clientCode: string;
  engagementId: string;
  displayName: string;
  offer: string;
  serviceFamily: string;
  engagementStart: string;
  renewalDate: string;
  targets: {
    revenueGrowthPct?: number;
    marginPct?: number;
    cashFloor?: number;
    ebitdaTarget?: number;
  };
  approvedKpis: ApprovedKpi[];
  ninetyDayPriorities: NinetyDayPriority[];
  commercial: {
    arr?: number;
    contractValue?: number;
    billingCadence?: string;
    primaryContact?: string;
    hvcgLead?: string;
  };
  gccOrganizationId: string;
}

export interface ExceptionItem {
  id: string;
  kind: ExceptionKind;
  severity: ExceptionSeverity;
  title: string;
  summary: string;
  owner: string;
  dueDate?: string;
  relatedMetric?: string;
  decisionNeeded?: string;
  confidence: EvidenceConfidence;
}

export interface ValueCreationInitiative {
  id: string;
  initiative: string;
  baseline: number;
  target: number;
  current: number;
  unit: "currency" | "percent" | "days" | "number";
  owner: string;
  status: ValueInitiativeStatus;
  evidence: string;
  financialImpact: number;
  operationalImpact: string;
  confidence: EvidenceConfidence;
  timeframe: string;
  startedAt: string;
  completedAt?: string;
}

export interface DecisionRequired {
  id: string;
  title: string;
  context: string;
  options: string[];
  owner: string;
  dueDate: string;
  urgency: ExceptionSeverity;
}

export interface RiskItem {
  id: string;
  title: string;
  description: string;
  severity: ExceptionSeverity;
  mitigation: string;
  owner: string;
}

export interface HvcgAction {
  id: string;
  action: string;
  owner: string;
  status: "planned" | "in_progress" | "done";
  evidence?: string;
  completedAt?: string;
}

export interface ClientAction {
  id: string;
  action: string;
  owner: string;
  status: "planned" | "in_progress" | "blocked" | "done";
  dueDate?: string;
}

export interface ExecutiveBrief {
  id: string;
  organizationId: string;
  clientCode: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: BriefApprovalStatus;
  executiveSummary: string;
  financialHighlights: string[];
  kpiMovement: { kpi: string; prior: number; current: number; unit: string; direction: "up" | "down" | "flat" }[];
  valueCreationProgress: string[];
  majorWins: string[];
  risks: string[];
  decisionsRequired: string[];
  ninetyDayPriorities: string[];
  hvcgActions: string[];
  clientActions: string[];
  draftedBy: "ai" | "human";
  approvedBy?: string;
  approvedAt?: string;
  confidenceNotes: string;
}

export interface AtlasOutboundSignal {
  contractVersion: "gcc-atlas-signal.v1";
  signalId: string;
  kind: SignalKind;
  clientCode: string;
  engagementId: string;
  gccOrganizationId: string;
  emittedAt: string;
  summary: string;
  severity: ExceptionSeverity;
  /** Non-sensitive payload suitable for Atlas commercial authority */
  payload: Record<string, string | number | boolean | null>;
  requiresAtlasAction: boolean;
  capitalOpsEligible: boolean;
}

export interface CapitalSignal {
  contractVersion: "gcc-atlas-capital-signal.v1";
  signalId: string;
  clientCode: string;
  engagementId: string;
  gccOrganizationId: string;
  emittedAt: string;
  rationale: string;
  estimatedNeed?: number;
  confidence: EvidenceConfidence;
  /** Atlas Capital Operations remains authoritative — GCC never starts lender outreach */
  lenderOutreachAllowed: false;
  status: "detected" | "staged" | "acknowledged";
}

export interface GtmFeedbackAggregate {
  contractVersion: "gcc-gtm-feedback.v1";
  periodLabel: string;
  serviceLine: string;
  clientRetentionSignal: "strong" | "stable" | "at_risk";
  expansionSignal: "ready" | "watch" | "none";
  engagementHealth: "healthy" | "mixed" | "weak";
  valueRealization: "high" | "moderate" | "low";
  outcomeCategories: string[];
  /** LTV only when valid aggregate; never raw client financials */
  ltvBand?: "a" | "b" | "c" | null;
  sensitiveFinancialExcluded: true;
}

export interface CockpitFinancialView {
  cashPosition: number;
  forecastedCash13wk: number;
  revenueMTD: number;
  revenueYTD: number;
  grossMarginPct: number;
  ebitda: number;
  ar: number;
  ap: number;
  runwayMonths: number;
  cashRiskWeeks: number;
}

export interface CockpitKpiView {
  key: string;
  label: string;
  current: number;
  target: number;
  prior: number;
  unit: ApprovedKpi["unit"];
  status: "green" | "yellow" | "red";
  trend: "improving" | "deteriorating" | "stable";
  confidence: EvidenceConfidence;
}

export interface ExecutiveCockpitPayload {
  organizationId: string;
  clientContext: ClientCommercialContext;
  asOf: string;
  narrative: {
    whereNow: string;
    whatChanged: string;
    improving: string[];
    deteriorating: string[];
    requiresDecision: string[];
    hvcgWorkingOn: string[];
    valueCreated: string;
    nextAction: string;
  };
  financials: CockpitFinancialView;
  cashWeeks: { week: number; endingBalance: number; isRiskPeriod: boolean }[];
  kpis: CockpitKpiView[];
  exceptions: ExceptionItem[];
  priorities: NinetyDayPriority[];
  risks: RiskItem[];
  decisions: DecisionRequired[];
  valueInitiatives: ValueCreationInitiative[];
  hvcgActions: HvcgAction[];
  clientActions: ClientAction[];
  signals: AtlasOutboundSignal[];
  capitalSignals: CapitalSignal[];
  briefStatus: BriefApprovalStatus;
  source: "synthetic";
}
