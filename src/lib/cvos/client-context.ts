import {
  ATLAS_GCC_ACTIVATION_CONTRACT,
  assertAtlasGccActivationContract,
  type AtlasGccActivationHandoff,
} from "../handoff/atlas-activation";
import type { ClientCommercialContext } from "./types";
import {
  SYN01_CLIENT_CONTEXT,
  SYNTHETIC_CLIENT_CODE,
  SYNTHETIC_ENGAGEMENT_ID,
  SYNTHETIC_ORG_ID,
} from "./synthetic";

export const CLIENT_CONTEXT_CONTRACT = "atlas-gcc-client-context.v1" as const;

/**
 * Maps a governed Atlas activation event + optional commercial context
 * into GCC client context. Does not provision users or grant access.
 */
export function mapActivationToClientContext(input: {
  activation: AtlasGccActivationHandoff;
  commercial?: Partial<ClientCommercialContext>;
  gccOrganizationId: string;
}): { ok: true; context: ClientCommercialContext } | { ok: false; issues: string[] } {
  const issues = assertAtlasGccActivationContract(input.activation);
  if (!input.gccOrganizationId.trim()) {
    issues.push("gccOrganizationId is required for tenant mapping");
  }
  if (issues.length > 0) return { ok: false, issues };

  const base =
    input.activation.client.clientCode === SYNTHETIC_CLIENT_CODE
      ? SYN01_CLIENT_CONTEXT
      : ({
          contractVersion: CLIENT_CONTEXT_CONTRACT,
          clientCode: input.activation.client.clientCode,
          engagementId: input.commercial?.engagementId ?? `ENG-${input.activation.client.clientCode}`,
          displayName: input.activation.client.displayName,
          offer: input.commercial?.offer ?? "Client Value Engagement",
          serviceFamily: input.commercial?.serviceFamily ?? "Client Value / Financial Intelligence",
          engagementStart: input.commercial?.engagementStart ?? input.activation.activation.activatedAt.slice(0, 10),
          renewalDate: input.commercial?.renewalDate ?? "",
          targets: input.commercial?.targets ?? {},
          approvedKpis: input.commercial?.approvedKpis ?? [],
          ninetyDayPriorities: input.commercial?.ninetyDayPriorities ?? [],
          commercial: input.commercial?.commercial ?? {},
          gccOrganizationId: input.gccOrganizationId,
        } satisfies ClientCommercialContext);

  return {
    ok: true,
    context: {
      ...base,
      ...input.commercial,
      contractVersion: CLIENT_CONTEXT_CONTRACT,
      clientCode: input.activation.client.clientCode,
      displayName: input.activation.client.displayName,
      gccOrganizationId: input.gccOrganizationId,
      approvedKpis: input.commercial?.approvedKpis ?? base.approvedKpis,
      ninetyDayPriorities: input.commercial?.ninetyDayPriorities ?? base.ninetyDayPriorities,
      targets: { ...base.targets, ...input.commercial?.targets },
      commercial: { ...base.commercial, ...input.commercial?.commercial },
    },
  };
}

/** Canonical SYN01 activation payload used in journey tests. */
export function syntheticActivationHandoff(): AtlasGccActivationHandoff {
  return {
    contractVersion: ATLAS_GCC_ACTIVATION_CONTRACT,
    source: {
      product: "atlas-hub",
      system: "HVCG_Clients",
      technology: "project-atlas",
    },
    emittedAt: "2026-08-20T00:00:00.000Z",
    idempotencyKey: `gcc-activate|${SYNTHETIC_CLIENT_CODE}|cvos-journey`,
    client: {
      clientCode: SYNTHETIC_CLIENT_CODE,
      displayName: SYN01_CLIENT_CONTEXT.displayName,
      clientStage: "Active Client",
      industry: "Industrial Services",
    },
    activation: {
      activatedAt: "2026-08-20T00:00:00.000Z",
      activatedBy: "e4835ea2-3c45-493a-95f5-472f6339661d",
      activationReason: "Governed Atlas Active Client → GCC Client Value OS",
      relatedOpportunityId: "4",
    },
    gcc: {
      action: "prepare_tenant_mapping",
      suggestedTenantSlug: "syn01",
      existingGccOrganizationId: SYNTHETIC_ORG_ID,
    },
    governance: {
      autoProvisionAccess: false,
      autoCreateUsers: false,
      autoSendInvites: false,
      observationOnly: true,
      duplicateAtlasCrm: false,
      requiresOwnerApproval: true,
    },
    attribution: {
      opportunityId: "4",
      source: "atlas-activation",
    },
  };
}

export function assertClientContextContract(ctx: ClientCommercialContext): string[] {
  const issues: string[] = [];
  if (ctx.contractVersion !== CLIENT_CONTEXT_CONTRACT) {
    issues.push("Unsupported client context contract version");
  }
  if (!/^[A-Z][A-Z0-9]{2,15}$/.test(ctx.clientCode)) {
    issues.push("clientCode must be canonical Atlas ClientCode");
  }
  if (!ctx.engagementId.trim()) issues.push("engagementId required");
  if (!ctx.gccOrganizationId.trim()) issues.push("gccOrganizationId required");
  if (!ctx.offer.trim()) issues.push("offer required");
  if (!ctx.serviceFamily.trim()) issues.push("serviceFamily required");
  return issues;
}

export { SYNTHETIC_ENGAGEMENT_ID, SYNTHETIC_ORG_ID, SYNTHETIC_CLIENT_CODE };
