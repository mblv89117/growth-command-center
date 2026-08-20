/**
 * CC-006 reconciliation: adapt GCC local signal models → Integration SoT
 * `gcc-value-signal.v1`. Platform Integration owns canonical meaning.
 * Local `gcc-atlas-signal.v1` remains an internal richer source, not SoT.
 */
import type { AtlasOutboundSignal, CapitalSignal, SignalKind } from "./types";

export const GCC_VALUE_SIGNAL_CONTRACT = "gcc-value-signal.v1" as const;

export type GccValueSignalType =
  | "renewal_risk"
  | "expansion_opportunity"
  | "value_realized"
  | "engagement_health"
  | "ltv_update";

export type GccValueSignal = {
  contractVersion: typeof GCC_VALUE_SIGNAL_CONTRACT;
  signalId: string;
  clientCode: string;
  gccOrganizationId?: string;
  signalType: GccValueSignalType;
  severity?: "low" | "medium" | "high" | "critical";
  summary?: string;
  metrics?: Record<string, string | number | boolean | null>;
  emittedAt: string;
  copiesLedger: false;
  envelope: {
    idempotencyKey: string;
    sourceSystem: "gcc";
    destinationSystem: "atlas";
    entity: "value_signal";
    operation: "signal";
    version: "gcc-value-signal.v1";
    replaySemantics: "return-existing";
    trace: {
      correlationId: string;
    };
  };
};

const KIND_TO_SOT: Partial<Record<SignalKind, GccValueSignalType>> = {
  high_realized_value: "value_realized",
  expansion_ready: "expansion_opportunity",
  contract_opportunity: "expansion_opportunity",
  renewal_risk: "renewal_risk",
  financial_deterioration: "renewal_risk",
  low_engagement: "engagement_health",
  new_constraint: "engagement_health",
  new_process_bottleneck: "engagement_health",
  new_ai_opportunity: "expansion_opportunity",
  new_capital_need: "expansion_opportunity",
};

function mapSeverity(
  severity: AtlasOutboundSignal["severity"],
): GccValueSignal["severity"] {
  if (severity === "info") return "low";
  return severity;
}

export function toGccValueSignal(signal: AtlasOutboundSignal): GccValueSignal | null {
  const signalType = KIND_TO_SOT[signal.kind];
  if (!signalType) return null;

  return {
    contractVersion: GCC_VALUE_SIGNAL_CONTRACT,
    signalId: signal.signalId,
    clientCode: signal.clientCode,
    gccOrganizationId: signal.gccOrganizationId,
    signalType,
    severity: mapSeverity(signal.severity),
    summary: signal.summary.slice(0, 2000),
    metrics: {
      ...signal.payload,
      engagementId: signal.engagementId,
      capitalOpsEligible: signal.capitalOpsEligible,
      requiresAtlasAction: signal.requiresAtlasAction,
      localContract: "gcc-atlas-signal.v1",
    },
    emittedAt: signal.emittedAt,
    copiesLedger: false,
    envelope: {
      idempotencyKey: `gcc-signal|${signal.clientCode}|${signal.signalId}`,
      sourceSystem: "gcc",
      destinationSystem: "atlas",
      entity: "value_signal",
      operation: "signal",
      version: "gcc-value-signal.v1",
      replaySemantics: "return-existing",
      trace: {
        correlationId: signal.signalId,
      },
    },
  };
}

/** Capital need is staged separately; map as expansion_opportunity metric only — never lender outreach. */
export function capitalToGccValueSignal(capital: CapitalSignal): GccValueSignal {
  return {
    contractVersion: GCC_VALUE_SIGNAL_CONTRACT,
    signalId: capital.signalId,
    clientCode: capital.clientCode,
    gccOrganizationId: capital.gccOrganizationId,
    signalType: "expansion_opportunity",
    severity: "medium",
    summary: capital.rationale.slice(0, 2000),
    metrics: {
      estimatedNeed: capital.estimatedNeed ?? null,
      confidence: capital.confidence,
      lenderOutreachAllowed: false,
      capitalContract: "gcc-atlas-capital-signal.v1",
      engagementId: capital.engagementId,
      status: capital.status,
    },
    emittedAt: capital.emittedAt,
    copiesLedger: false,
    envelope: {
      idempotencyKey: `gcc-signal|${capital.clientCode}|${capital.signalId}`,
      sourceSystem: "gcc",
      destinationSystem: "atlas",
      entity: "value_signal",
      operation: "signal",
      version: "gcc-value-signal.v1",
      replaySemantics: "return-existing",
      trace: {
        correlationId: capital.signalId,
      },
    },
  };
}

export function assertGccValueSignal(signal: GccValueSignal): string[] {
  const issues: string[] = [];
  if (signal.contractVersion !== GCC_VALUE_SIGNAL_CONTRACT) {
    issues.push("Unsupported gcc-value-signal contract version");
  }
  if (signal.copiesLedger !== false) {
    issues.push("copiesLedger must be false — GCC must not write Atlas CRM ledgers");
  }
  if (signal.envelope.sourceSystem !== "gcc" || signal.envelope.destinationSystem !== "atlas") {
    issues.push("envelope systems must be gcc → atlas");
  }
  if (!signal.envelope.idempotencyKey.startsWith("gcc-signal|")) {
    issues.push("idempotencyKey must use gcc-signal|{ClientCode}|{signalId}");
  }
  return issues;
}
