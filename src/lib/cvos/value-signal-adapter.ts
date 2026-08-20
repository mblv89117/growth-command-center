/**
 * CC-006: adapt GCC local signal models → Integration SoT `gcc-value-signal.v1`
 * Consumed from hvcg-05 `cursor/platform-integration-contracts` @ 773b510.
 * Mapping table per docs/integrations/schemas/adapters/gcc-atlas-signal-to-value-signal.md
 */
import type { AtlasOutboundSignal, CapitalSignal, SignalKind } from "./types";

export const GCC_VALUE_SIGNAL_CONTRACT = "gcc-value-signal.v1" as const;
export const INTEGRATION_SOT_SHA = "773b5101032ccd5218d5563d2177c31722ecf575" as const;

export type GccValueSignalType =
  | "renewal_risk"
  | "expansion_opportunity"
  | "value_realized"
  | "engagement_health"
  | "ltv_update"
  | "capital_need"
  | "constraint"
  | "ai_opportunity"
  | "process_bottleneck"
  | "contract_opportunity";

export type GccValueSignal = {
  contractVersion: typeof GCC_VALUE_SIGNAL_CONTRACT;
  signalId: string;
  clientCode: string;
  gccOrganizationId?: string;
  engagementId?: string;
  kind?: SignalKind;
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

/** Integration SoT adapter map — do not invent alternate meaning. */
const KIND_TO_SOT: Record<SignalKind, GccValueSignalType> = {
  renewal_risk: "renewal_risk",
  expansion_ready: "expansion_opportunity",
  high_realized_value: "value_realized",
  low_engagement: "engagement_health",
  financial_deterioration: "renewal_risk",
  new_capital_need: "capital_need",
  new_constraint: "constraint",
  new_ai_opportunity: "ai_opportunity",
  new_process_bottleneck: "process_bottleneck",
  contract_opportunity: "contract_opportunity",
};

function mapSeverity(
  severity: AtlasOutboundSignal["severity"],
): GccValueSignal["severity"] {
  if (severity === "info") return "low";
  if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
    return severity;
  }
  return "medium";
}

export function toGccValueSignal(signal: AtlasOutboundSignal): GccValueSignal {
  const signalType = KIND_TO_SOT[signal.kind];
  return {
    contractVersion: GCC_VALUE_SIGNAL_CONTRACT,
    signalId: signal.signalId,
    clientCode: signal.clientCode,
    gccOrganizationId: signal.gccOrganizationId,
    engagementId: signal.engagementId,
    kind: signal.kind,
    signalType,
    severity: mapSeverity(signal.severity),
    summary: signal.summary.slice(0, 2000),
    metrics: {
      ...signal.payload,
      capitalOpsEligible: signal.capitalOpsEligible,
      requiresAtlasAction: signal.requiresAtlasAction,
    },
    emittedAt: signal.emittedAt,
    copiesLedger: false,
    envelope: {
      idempotencyKey: `gcc-signal|${signal.signalId}`,
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

/** Capital need → canonical capital_need; never lender outreach. */
export function capitalToGccValueSignal(capital: CapitalSignal): GccValueSignal {
  return {
    contractVersion: GCC_VALUE_SIGNAL_CONTRACT,
    signalId: capital.signalId,
    clientCode: capital.clientCode,
    gccOrganizationId: capital.gccOrganizationId,
    engagementId: capital.engagementId,
    kind: "new_capital_need",
    signalType: "capital_need",
    severity: "medium",
    summary: capital.rationale.slice(0, 2000),
    metrics: {
      estimatedNeed: capital.estimatedNeed ?? null,
      confidence: capital.confidence,
      lenderOutreachAllowed: false,
      status: capital.status,
    },
    emittedAt: capital.emittedAt,
    copiesLedger: false,
    envelope: {
      idempotencyKey: `gcc-signal|${capital.signalId}`,
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
    issues.push("idempotencyKey must use gcc-signal|{signalId}");
  }
  if (signal.gccOrganizationId && signal.gccOrganizationId === signal.clientCode) {
    issues.push("gccOrganizationId must never equal ClientCode");
  }
  return issues;
}
