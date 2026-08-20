import type { EvidenceConfidence, ValueCreationInitiative } from "./types";
import { SYN01_VALUE_INITIATIVES, isCvosSyntheticOrg } from "./synthetic";
import { sumVerifiedFinancialImpact } from "./cockpit";

export interface ValueCreationBoard {
  organizationId: string;
  initiatives: ValueCreationInitiative[];
  verifiedFinancialImpact: number;
  estimatedFinancialImpact: number;
  inferredCount: number;
  story: {
    whatHvcgDone: string[];
    whatChanged: string[];
    evidencedValue: string;
    remains: string[];
    nextHighestValueAction: string;
  };
}

function impactByConfidence(
  initiatives: ValueCreationInitiative[],
  confidence: EvidenceConfidence,
): number {
  return initiatives
    .filter((i) => i.confidence === confidence && i.financialImpact > 0)
    .reduce((s, i) => s + i.financialImpact, 0);
}

export function buildValueCreationBoard(organizationId: string): ValueCreationBoard | null {
  if (!isCvosSyntheticOrg(organizationId)) return null;
  const initiatives = SYN01_VALUE_INITIATIVES;
  return {
    organizationId,
    initiatives,
    verifiedFinancialImpact: sumVerifiedFinancialImpact(initiatives),
    estimatedFinancialImpact: impactByConfidence(initiatives, "ESTIMATED"),
    inferredCount: initiatives.filter((i) => i.confidence === "INFERRED").length,
    story: {
      whatHvcgDone: [
        "Installed 13-week cash operating rhythm",
        "Deployed AR collections playbook + weekly aging review",
        "Coaching job-margin recovery on top contracts",
        "Scoped AI invoice triage pilot (no financial claim yet)",
      ],
      whatChanged: [
        "DSO 58 → 49 days (VERIFIED)",
        "Cash timing improved ~$186k (VERIFIED)",
        "Leadership has 6+ week visibility into cash troughs",
        "Gross margin still soft on MX-441",
      ],
      evidencedValue:
        "VERIFIED financial impact limited to AR cash-timing (~$186k). Margin and AI impacts are ESTIMATED/INFERRED only.",
      remains: [
        "Blunt week 7–8 cash trough",
        "Recover MX-441 margin via change-order",
        "Close remaining DSO gap to 42-day target",
        "Renewal evidence pack",
      ],
      nextHighestValueAction:
        "CEO decision on early-pay incentive — highest leverage against cash trough and DSO target.",
    },
  };
}

/** Guard: refuse to present INFERRED amounts as verified finance. */
export function assertNoFabricatedFinance(initiatives: ValueCreationInitiative[]): string[] {
  const issues: string[] = [];
  for (const i of initiatives) {
    if (i.confidence === "INFERRED" && i.financialImpact > 0) {
      issues.push(`${i.id}: INFERRED initiatives must not claim financialImpact > 0`);
    }
    if (i.confidence !== "VERIFIED" && i.status === "verified") {
      issues.push(`${i.id}: status=verified requires VERIFIED confidence`);
    }
  }
  return issues;
}
