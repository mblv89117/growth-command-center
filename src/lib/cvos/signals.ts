import type { AtlasOutboundSignal, CapitalSignal, GtmFeedbackAggregate, SignalKind } from "./types";
import {
  buildSyn01CapitalSignal,
  buildSyn01GtmFeedback,
  buildSyn01Signals,
  isCvosSyntheticOrg,
} from "./synthetic";

const SIGNAL_PRIORITY: Record<SignalKind, number> = {
  financial_deterioration: 0,
  renewal_risk: 1,
  new_capital_need: 2,
  low_engagement: 3,
  new_constraint: 4,
  new_process_bottleneck: 5,
  contract_opportunity: 6,
  expansion_ready: 7,
  high_realized_value: 8,
  new_ai_opportunity: 9,
};

export function detectSignals(organizationId: string): {
  signals: AtlasOutboundSignal[];
  capital: CapitalSignal[];
} {
  if (!isCvosSyntheticOrg(organizationId)) {
    return { signals: [], capital: [] };
  }
  const signals = [...buildSyn01Signals(organizationId)].sort(
    (a, b) => (SIGNAL_PRIORITY[a.kind] ?? 99) - (SIGNAL_PRIORITY[b.kind] ?? 99),
  );
  return {
    signals,
    capital: [buildSyn01CapitalSignal(organizationId)],
  };
}

/** Atlas remains commercial authority; GCC only stages structured signals. */
export function assertCapitalSignalGovernance(signal: CapitalSignal): string[] {
  const issues: string[] = [];
  if (signal.lenderOutreachAllowed !== false) {
    issues.push("lenderOutreachAllowed must be false — Atlas Capital Ops is authoritative");
  }
  if (signal.contractVersion !== "gcc-atlas-capital-signal.v1") {
    issues.push("Unsupported capital signal contract");
  }
  if (signal.confidence === "VERIFIED" && !signal.estimatedNeed) {
    issues.push("VERIFIED capital signal should include estimatedNeed");
  }
  return issues;
}

export function getGtmFeedback(organizationId: string): GtmFeedbackAggregate | null {
  if (!isCvosSyntheticOrg(organizationId)) return null;
  return buildSyn01GtmFeedback();
}

export function assertGtmFeedbackSafe(feedback: GtmFeedbackAggregate): string[] {
  const issues: string[] = [];
  if (feedback.sensitiveFinancialExcluded !== true) {
    issues.push("GTM feedback must exclude sensitive client financials");
  }
  const serialized = JSON.stringify(feedback).toLowerCase();
  for (const banned of ["bank", "ssn", "account_number", "routing"]) {
    if (serialized.includes(banned)) {
      issues.push(`GTM feedback must not include ${banned}`);
    }
  }
  return issues;
}
