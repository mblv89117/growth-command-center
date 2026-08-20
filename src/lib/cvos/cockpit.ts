import type {
  AtlasOutboundSignal,
  CapitalSignal,
  CockpitKpiView,
  EvidenceConfidence,
  ExceptionItem,
  ValueCreationInitiative,
} from "./types";
import {
  SYN01_CASH_WEEKS,
  SYN01_CLIENT_ACTIONS,
  SYN01_DECISIONS,
  SYN01_EXCEPTIONS,
  SYN01_HVCG_ACTIONS,
  SYN01_RISKS,
  SYN01_VALUE_INITIATIVES,
  buildSyn01CapitalSignal,
  buildSyn01Signals,
  isCvosSyntheticOrg,
  resolveClientContextForOrg,
} from "./synthetic";
import type { ExecutiveCockpitPayload } from "./types";

function kpiViews(): CockpitKpiView[] {
  return [
    {
      key: "cash_position",
      label: "Cash Position",
      current: 487000,
      target: 450000,
      prior: 462000,
      unit: "currency",
      status: "green",
      trend: "improving",
      confidence: "VERIFIED",
    },
    {
      key: "gross_margin",
      label: "Gross Margin",
      current: 26.1,
      target: 28,
      prior: 27.5,
      unit: "percent",
      status: "yellow",
      trend: "deteriorating",
      confidence: "VERIFIED",
    },
    {
      key: "dso",
      label: "DSO",
      current: 49,
      target: 42,
      prior: 58,
      unit: "days",
      status: "yellow",
      trend: "improving",
      confidence: "VERIFIED",
    },
    {
      key: "revenue_growth",
      label: "Revenue Growth",
      current: 8.6,
      target: 12,
      prior: 6.2,
      unit: "percent",
      status: "yellow",
      trend: "improving",
      confidence: "ESTIMATED",
    },
    {
      key: "ebitda",
      label: "EBITDA",
      current: 1125600,
      target: 1200000,
      prior: 980000,
      unit: "currency",
      status: "yellow",
      trend: "improving",
      confidence: "ESTIMATED",
    },
  ];
}

/** Never claim financial improvement without VERIFIED evidence. */
export function sumVerifiedFinancialImpact(initiatives: ValueCreationInitiative[]): number {
  return initiatives
    .filter((i) => i.confidence === "VERIFIED" && i.financialImpact > 0)
    .reduce((sum, i) => sum + i.financialImpact, 0);
}

export function labelConfidence(c: EvidenceConfidence): string {
  return c;
}

export function prioritizeExceptions(items: ExceptionItem[]): ExceptionItem[] {
  const order: Record<ExceptionItem["kind"], number> = {
    decision_required: 0,
    cash_risk: 1,
    at_risk: 2,
    off_track: 3,
    needs_attention: 4,
    kpi_deterioration: 5,
    forecast_variance: 6,
    data_missing: 7,
    opportunity: 8,
    ready: 9,
    outcome: 10,
  };
  return [...items].sort((a, b) => order[a.kind] - order[b.kind]);
}

export function buildExecutiveCockpit(organizationId: string): ExecutiveCockpitPayload | null {
  if (!isCvosSyntheticOrg(organizationId)) return null;

  const clientContext = resolveClientContextForOrg(organizationId);
  const valueInitiatives = SYN01_VALUE_INITIATIVES;
  const verifiedImpact = sumVerifiedFinancialImpact(valueInitiatives);
  const signals = buildSyn01Signals(organizationId);
  const capitalSignals = [buildSyn01CapitalSignal(organizationId)];

  return {
    organizationId,
    clientContext,
    asOf: "2026-08-20T12:00:00.000Z",
    narrative: {
      whereNow:
        "Cash is adequate near-term ($487k) with a modeled trough in weeks 7–8. Operations are busy; margin discipline is the soft spot.",
      whatChanged:
        "DSO improved 9 days under the HVCG AR rhythm. Gross margin slipped 1.4 pts on Job MX-441. 13-week cash visibility is now institutional.",
      improving: ["DSO / cash timing", "Cash visibility & forecast cadence", "EBITDA run-rate (ESTIMATED)"],
      deteriorating: ["Gross margin (−1.4 pts MoM)", "Week 7–8 cash vs floor"],
      requiresDecision: [
        "Early-pay incentive on 60+ AR",
        "MX-441 change-order path",
      ],
      hvcgWorkingOn: [
        "AR operating rhythm",
        "Margin recovery coaching",
        "August executive brief (pending approval)",
        "Governed capital signal to Atlas",
      ],
      valueCreated: `VERIFIED cash-timing benefit ~$${verifiedImpact.toLocaleString("en-US")} from AR rhythm. No unverified ROI claimed.`,
      nextAction:
        "Secure CEO decision on early-pay incentive before Aug 27 to blunt the week 7–8 trough.",
    },
    financials: {
      cashPosition: 487000,
      forecastedCash13wk: 428000,
      revenueMTD: 892400,
      revenueYTD: 6840000,
      grossMarginPct: 26.1,
      ebitda: 1125600,
      ar: 1245800,
      ap: 687300,
      runwayMonths: 3.4,
      cashRiskWeeks: SYN01_CASH_WEEKS.filter((w) => w.isRiskPeriod).length,
    },
    cashWeeks: SYN01_CASH_WEEKS,
    kpis: kpiViews(),
    exceptions: prioritizeExceptions(SYN01_EXCEPTIONS),
    priorities: clientContext.ninetyDayPriorities,
    risks: SYN01_RISKS,
    decisions: SYN01_DECISIONS,
    valueInitiatives,
    hvcgActions: SYN01_HVCG_ACTIONS,
    clientActions: SYN01_CLIENT_ACTIONS,
    signals,
    capitalSignals,
    briefStatus: "pending_approval",
    source: "synthetic",
  };
}

export function stageSignalsForAtlas(organizationId: string): {
  signals: AtlasOutboundSignal[];
  capital: CapitalSignal[];
} {
  if (!isCvosSyntheticOrg(organizationId)) {
    return { signals: [], capital: [] };
  }
  return {
    signals: buildSyn01Signals(organizationId),
    capital: [buildSyn01CapitalSignal(organizationId)],
  };
}
