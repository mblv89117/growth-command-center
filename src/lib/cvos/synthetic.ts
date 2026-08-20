import type {
  AtlasOutboundSignal,
  CapitalSignal,
  ClientAction,
  ClientCommercialContext,
  DecisionRequired,
  ExceptionItem,
  ExecutiveBrief,
  GtmFeedbackAggregate,
  HvcgAction,
  RiskItem,
  ValueCreationInitiative,
} from "./types";

/** Safe synthetic tenant — proves Atlas handoff → cockpit → signals journey. No live client data. */
export const SYNTHETIC_ORG_ID = "org-syn01";
export const SYNTHETIC_CLIENT_CODE = "SYN01";
export const SYNTHETIC_ENGAGEMENT_ID = "ENG-SYN01-2026";

/** Demo sessions (org-apex) also render this populated CVOS state for local proof. */
export const CVOS_DEMO_ORG_IDS = new Set(["org-apex", SYNTHETIC_ORG_ID]);

export function isCvosSyntheticOrg(organizationId: string): boolean {
  return CVOS_DEMO_ORG_IDS.has(organizationId);
}

export const SYN01_CLIENT_CONTEXT: ClientCommercialContext = {
  contractVersion: "atlas-gcc-client-context.v1",
  clientCode: SYNTHETIC_CLIENT_CODE,
  engagementId: SYNTHETIC_ENGAGEMENT_ID,
  displayName: "SYNTHETIC QA — Meridian Industrial Services",
  offer: "Fractional CFO + Cash Operating System",
  serviceFamily: "Client Value / Financial Intelligence",
  engagementStart: "2026-05-01",
  renewalDate: "2027-04-30",
  targets: {
    revenueGrowthPct: 12,
    marginPct: 28,
    cashFloor: 350000,
    ebitdaTarget: 1200000,
  },
  approvedKpis: [
    { key: "cash_position", label: "Cash Position", target: 450000, unit: "currency", baseline: 312000 },
    { key: "gross_margin", label: "Gross Margin", target: 28, unit: "percent", baseline: 22 },
    { key: "dso", label: "DSO", target: 42, unit: "days", baseline: 58 },
    { key: "revenue_growth", label: "Revenue Growth", target: 12, unit: "percent", baseline: 4 },
    { key: "ebitda", label: "EBITDA", target: 1200000, unit: "currency", baseline: 780000 },
  ],
  ninetyDayPriorities: [
    {
      id: "p1",
      title: "Stabilize 13-week cash floor above $350k",
      owner: "HVCG — A. Rivera",
      dueDate: "2026-09-30",
      status: "in_progress",
      rank: 1,
    },
    {
      id: "p2",
      title: "Reduce DSO from 58 → 45 days",
      owner: "Client — Controller",
      dueDate: "2026-10-15",
      status: "in_progress",
      rank: 2,
    },
    {
      id: "p3",
      title: "Lock Q4 pricing discipline on top 5 jobs",
      owner: "HVCG — Ops Lead",
      dueDate: "2026-10-31",
      status: "not_started",
      rank: 3,
    },
    {
      id: "p4",
      title: "Prepare renewal evidence pack",
      owner: "HVCG — Client Value",
      dueDate: "2026-11-15",
      status: "not_started",
      rank: 4,
    },
  ],
  commercial: {
    arr: 180000,
    contractValue: 180000,
    billingCadence: "monthly",
    primaryContact: "Jordan Hale (CEO)",
    hvcgLead: "A. Rivera",
  },
  gccOrganizationId: SYNTHETIC_ORG_ID,
};

export const SYN01_EXCEPTIONS: ExceptionItem[] = [
  {
    id: "ex-1",
    kind: "decision_required",
    severity: "high",
    title: "Approve AR acceleration plan",
    summary: "Collections >60 days at $214k. Decision needed on discount vs. stop-work threshold.",
    owner: "Jordan Hale",
    dueDate: "2026-08-27",
    relatedMetric: "DSO",
    decisionNeeded: "Approve 1.5% early-pay incentive for 60+ AR",
    confidence: "VERIFIED",
  },
  {
    id: "ex-2",
    kind: "cash_risk",
    severity: "high",
    title: "Week 7–8 cash trough",
    summary: "13-week model shows ending cash dipping to $318k (below $350k floor) in weeks 7–8.",
    owner: "A. Rivera",
    dueDate: "2026-09-05",
    relatedMetric: "cash_position",
    confidence: "ESTIMATED",
  },
  {
    id: "ex-3",
    kind: "kpi_deterioration",
    severity: "medium",
    title: "Gross margin slipped 1.4 pts MoM",
    summary: "Subcontractor overruns on Job MX-441. Margin 26.1% vs 27.5% prior month.",
    owner: "Ops Lead",
    relatedMetric: "gross_margin",
    confidence: "VERIFIED",
  },
  {
    id: "ex-4",
    kind: "opportunity",
    severity: "info",
    title: "Working-capital facility signal",
    summary: "Stabilizing cash + backlog growth suggests governed capital conversation with Atlas Capital Ops.",
    owner: "HVCG Capital Desk",
    confidence: "INFERRED",
  },
  {
    id: "ex-5",
    kind: "ready",
    severity: "info",
    title: "Value initiative — DSO playbook verified",
    summary: "Collections SOP + weekly AR huddle reduced DSO from 58 → 49 days. Evidence logged.",
    owner: "A. Rivera",
    confidence: "VERIFIED",
  },
];

export const SYN01_VALUE_INITIATIVES: ValueCreationInitiative[] = [
  {
    id: "vc-1",
    initiative: "AR collections operating rhythm",
    baseline: 58,
    target: 42,
    current: 49,
    unit: "days",
    owner: "A. Rivera",
    status: "on_track",
    evidence: "Weekly AR aging review; 12 invoices collected early in July–Aug (bank deposits matched).",
    financialImpact: 186000,
    operationalImpact: "Freed ~$186k cash timing; controller cadence institutionalized",
    confidence: "VERIFIED",
    timeframe: "May–Oct 2026",
    startedAt: "2026-05-15",
  },
  {
    id: "vc-2",
    initiative: "13-week cash forecast discipline",
    baseline: 0,
    target: 1,
    current: 1,
    unit: "number",
    owner: "HVCG — Client Value",
    status: "completed",
    evidence: "Living 13-week model reviewed in biweekly exec huddle; variance logged.",
    financialImpact: 0,
    operationalImpact: "Leadership visibility of cash troughs 6+ weeks ahead",
    confidence: "VERIFIED",
    timeframe: "May–Jun 2026",
    startedAt: "2026-05-01",
    completedAt: "2026-06-20",
  },
  {
    id: "vc-3",
    initiative: "Job margin recovery — top 5 contracts",
    baseline: 22,
    target: 28,
    current: 26.1,
    unit: "percent",
    owner: "Ops Lead",
    status: "at_risk",
    evidence: "Job MX-441 overrun; corrective change-order pending client approval.",
    financialImpact: 42000,
    operationalImpact: "Pricing checklist rolled out; 3 of 5 jobs on track",
    confidence: "ESTIMATED",
    timeframe: "Jul–Nov 2026",
    startedAt: "2026-07-01",
  },
  {
    id: "vc-4",
    initiative: "AI invoice triage pilot",
    baseline: 0,
    target: 20,
    current: 8,
    unit: "percent",
    owner: "HVCG — AI Ops",
    status: "active",
    evidence: "Pilot flagged 8% of invoices for early follow-up; not yet attributed to cash lift.",
    financialImpact: 0,
    operationalImpact: "Reduced manual AR sorting time ~4 hrs/week (estimated)",
    confidence: "INFERRED",
    timeframe: "Aug–Dec 2026",
    startedAt: "2026-08-01",
  },
];

export const SYN01_DECISIONS: DecisionRequired[] = [
  {
    id: "dec-1",
    title: "Early-pay incentive on 60+ AR",
    context: "$214k past 60 days. Incentive cost ~$3.2k vs. cash risk in weeks 7–8.",
    options: ["Approve 1.5% early-pay", "Stop-work on 90+ only", "Defer — accept trough"],
    owner: "Jordan Hale",
    dueDate: "2026-08-27",
    urgency: "high",
  },
  {
    id: "dec-2",
    title: "Change-order on Job MX-441",
    context: "Sub overrun $48k. Margin recovery depends on CO approval.",
    options: ["Submit CO this week", "Absorb and reprice next bids", "Partial absorb"],
    owner: "Ops Lead",
    dueDate: "2026-09-02",
    urgency: "medium",
  },
];

export const SYN01_RISKS: RiskItem[] = [
  {
    id: "risk-1",
    title: "Concentrated AR — top 2 customers",
    description: "48% of AR in two accounts; one disputed retainage.",
    severity: "high",
    mitigation: "Escalate dispute; diversify billing milestones",
    owner: "Controller",
  },
  {
    id: "risk-2",
    title: "Subcontractor cost inflation",
    description: "Materials + labor quotes up 6% QoQ on open bids.",
    severity: "medium",
    mitigation: "Lock quotes within 14 days; contingency on proposals",
    owner: "Ops Lead",
  },
];

export const SYN01_HVCG_ACTIONS: HvcgAction[] = [
  {
    id: "ha-1",
    action: "Installed 13-week cash operating rhythm",
    owner: "A. Rivera",
    status: "done",
    evidence: "Model + huddle cadence live since Jun 2026",
    completedAt: "2026-06-20",
  },
  {
    id: "ha-2",
    action: "AR playbook + weekly aging review",
    owner: "A. Rivera",
    status: "done",
    evidence: "DSO 58→49 verified against bank deposits",
    completedAt: "2026-08-10",
  },
  {
    id: "ha-3",
    action: "Draft monthly executive brief for Aug 2026",
    owner: "HVCG — Client Value",
    status: "in_progress",
  },
  {
    id: "ha-4",
    action: "Stage capital-need signal to Atlas (no lender outreach)",
    owner: "HVCG — Client Value",
    status: "planned",
  },
];

export const SYN01_CLIENT_ACTIONS: ClientAction[] = [
  {
    id: "ca-1",
    action: "Approve early-pay incentive policy",
    owner: "Jordan Hale",
    status: "blocked",
    dueDate: "2026-08-27",
  },
  {
    id: "ca-2",
    action: "Submit MX-441 change-order package",
    owner: "Ops Lead",
    status: "in_progress",
    dueDate: "2026-09-02",
  },
  {
    id: "ca-3",
    action: "Provide Q3 WIP schedule for forecast refresh",
    owner: "Controller",
    status: "planned",
    dueDate: "2026-09-05",
  },
];

export const SYN01_CASH_WEEKS = [
  { week: 1, endingBalance: 487000, isRiskPeriod: false },
  { week: 2, endingBalance: 462000, isRiskPeriod: false },
  { week: 3, endingBalance: 441000, isRiskPeriod: false },
  { week: 4, endingBalance: 428000, isRiskPeriod: false },
  { week: 5, endingBalance: 401000, isRiskPeriod: false },
  { week: 6, endingBalance: 378000, isRiskPeriod: false },
  { week: 7, endingBalance: 331000, isRiskPeriod: true },
  { week: 8, endingBalance: 318000, isRiskPeriod: true },
  { week: 9, endingBalance: 356000, isRiskPeriod: false },
  { week: 10, endingBalance: 372000, isRiskPeriod: false },
  { week: 11, endingBalance: 395000, isRiskPeriod: false },
  { week: 12, endingBalance: 412000, isRiskPeriod: false },
  { week: 13, endingBalance: 428000, isRiskPeriod: false },
];

export function buildSyn01Signals(organizationId: string): AtlasOutboundSignal[] {
  const emittedAt = "2026-08-20T12:00:00.000Z";
  return [
    {
      contractVersion: "gcc-atlas-signal.v1",
      signalId: "sig-syn01-value",
      kind: "high_realized_value",
      clientCode: SYNTHETIC_CLIENT_CODE,
      engagementId: SYNTHETIC_ENGAGEMENT_ID,
      gccOrganizationId: organizationId,
      emittedAt,
      summary: "Verified AR rhythm freed ~$186k cash timing; DSO improved 9 days.",
      severity: "info",
      payload: {
        valueConfidence: "VERIFIED",
        dsoDeltaDays: -9,
        initiativeId: "vc-1",
      },
      requiresAtlasAction: false,
      capitalOpsEligible: false,
    },
    {
      contractVersion: "gcc-atlas-signal.v1",
      signalId: "sig-syn01-capital",
      kind: "new_capital_need",
      clientCode: SYNTHETIC_CLIENT_CODE,
      engagementId: SYNTHETIC_ENGAGEMENT_ID,
      gccOrganizationId: organizationId,
      emittedAt,
      summary: "Cash trough + backlog growth indicates likely working-capital need.",
      severity: "medium",
      payload: {
        troughCash: 318000,
        cashFloor: 350000,
        estimatedNeedBand: "250k-500k",
      },
      requiresAtlasAction: true,
      capitalOpsEligible: true,
    },
    {
      contractVersion: "gcc-atlas-signal.v1",
      signalId: "sig-syn01-ai",
      kind: "new_ai_opportunity",
      clientCode: SYNTHETIC_CLIENT_CODE,
      engagementId: SYNTHETIC_ENGAGEMENT_ID,
      gccOrganizationId: organizationId,
      emittedAt,
      summary: "Invoice triage pilot showing early operational lift; expand scoped pilot.",
      severity: "info",
      payload: {
        pilotCoveragePct: 8,
        confidence: "INFERRED",
      },
      requiresAtlasAction: false,
      capitalOpsEligible: false,
    },
    {
      contractVersion: "gcc-atlas-signal.v1",
      signalId: "sig-syn01-renewal",
      kind: "expansion_ready",
      clientCode: SYNTHETIC_CLIENT_CODE,
      engagementId: SYNTHETIC_ENGAGEMENT_ID,
      gccOrganizationId: organizationId,
      emittedAt,
      summary: "Verified value + renewal window in 8 months — expansion conversation eligible.",
      severity: "info",
      payload: {
        renewalDate: SYN01_CLIENT_CONTEXT.renewalDate,
        verifiedInitiatives: 2,
      },
      requiresAtlasAction: true,
      capitalOpsEligible: false,
    },
  ];
}

export function buildSyn01CapitalSignal(organizationId: string): CapitalSignal {
  return {
    contractVersion: "gcc-atlas-capital-signal.v1",
    signalId: "cap-syn01-001",
    clientCode: SYNTHETIC_CLIENT_CODE,
    engagementId: SYNTHETIC_ENGAGEMENT_ID,
    gccOrganizationId: organizationId,
    emittedAt: "2026-08-20T12:00:00.000Z",
    rationale:
      "13-week trough below cash floor with expanding backlog. Governed signal only — Atlas Capital Operations decides outreach.",
    estimatedNeed: 350000,
    confidence: "INFERRED",
    lenderOutreachAllowed: false,
    status: "staged",
  };
}

export function buildSyn01Brief(organizationId: string): ExecutiveBrief {
  return {
    id: "brief-syn01-2026-08",
    organizationId,
    clientCode: SYNTHETIC_CLIENT_CODE,
    periodLabel: "August 2026",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    status: "pending_approval",
    executiveSummary:
      "Meridian’s cash position is stable near-term but faces a modeled trough in weeks 7–8. HVCG’s AR operating rhythm verified a 9-day DSO improvement and ~$186k cash-timing benefit. Margin recovery remains the open risk. Two executive decisions are outstanding before September.",
    financialHighlights: [
      "Cash $487k; 13-week ending modeled $428k",
      "Trough $318k in weeks 7–8 (below $350k floor)",
      "Revenue MTD on plan; gross margin 26.1% (−1.4 pts MoM)",
      "EBITDA tracking toward $1.12M run-rate (ESTIMATED)",
    ],
    kpiMovement: [
      { kpi: "DSO", prior: 58, current: 49, unit: "days", direction: "up" },
      { kpi: "Gross Margin", prior: 27.5, current: 26.1, unit: "percent", direction: "down" },
      { kpi: "Cash Position", prior: 462000, current: 487000, unit: "currency", direction: "up" },
    ],
    valueCreationProgress: [
      "VERIFIED: AR rhythm — DSO 58→49; ~$186k cash timing",
      "VERIFIED: 13-week cash discipline institutionalized",
      "ESTIMATED: Job margin recovery — 3/5 jobs on track; MX-441 at risk",
      "INFERRED: AI invoice triage — operational time save only; no financial claim",
    ],
    majorWins: [
      "Collections SOP live; early collections matched to bank deposits",
      "Biweekly cash huddle adopted by CEO + Controller",
    ],
    risks: [
      "Week 7–8 cash trough below floor",
      "MX-441 margin overrun pending change-order",
      "AR concentration in top 2 customers",
    ],
    decisionsRequired: [
      "Approve 1.5% early-pay incentive on 60+ AR",
      "Submit or absorb MX-441 change-order",
    ],
    ninetyDayPriorities: SYN01_CLIENT_CONTEXT.ninetyDayPriorities.map(
      (p) => `#${p.rank} ${p.title} (${p.status})`,
    ),
    hvcgActions: [
      "Drafted this brief for human approval before external delivery",
      "Staged capital-need signal to Atlas Capital Ops (no lender outreach)",
      "Continue AR cadence + margin recovery coaching",
    ],
    clientActions: [
      "Approve early-pay incentive by Aug 27",
      "Submit MX-441 CO package by Sep 2",
      "Provide Q3 WIP schedule by Sep 5",
    ],
    draftedBy: "ai",
    confidenceNotes:
      "Financial improvement claims limited to VERIFIED initiatives. Margin and capital need marked ESTIMATED/INFERRED. No fabricated ROI.",
  };
}

export function buildSyn01GtmFeedback(): GtmFeedbackAggregate {
  return {
    contractVersion: "gcc-gtm-feedback.v1",
    periodLabel: "2026-Q3",
    serviceLine: "Fractional CFO + Cash Operating System",
    clientRetentionSignal: "strong",
    expansionSignal: "ready",
    engagementHealth: "healthy",
    valueRealization: "high",
    outcomeCategories: ["cash_visibility", "ar_acceleration", "operating_cadence"],
    ltvBand: "a",
    sensitiveFinancialExcluded: true,
  };
}

export function resolveClientContextForOrg(organizationId: string): ClientCommercialContext {
  const ctx = { ...SYN01_CLIENT_CONTEXT, gccOrganizationId: organizationId };
  if (organizationId === "org-apex") {
    return {
      ...ctx,
      displayName: "Apex Construction Group (Synthetic CVOS overlay)",
      gccOrganizationId: "org-apex",
    };
  }
  return ctx;
}
