export const ATLAS_GCC_ACTIVATION_CONTRACT = "atlas-gcc-client-activation.v1" as const;

export type AtlasGccActivationHandoff = {
  contractVersion: typeof ATLAS_GCC_ACTIVATION_CONTRACT;
  source: {
    product: "atlas-hub";
    system: "HVCG_Clients";
    technology: "project-atlas";
  };
  emittedAt: string;
  idempotencyKey: string;
  client: {
    clientCode: string;
    atlasClientItemId?: string;
    displayName: string;
    clientStage: "Active Client";
    industry?: string;
  };
  activation: {
    activatedAt: string;
    activatedBy: string;
    activationReason: string;
    relatedOpportunityId?: string;
  };
  gcc: {
    action: "prepare_tenant_mapping";
    suggestedTenantSlug?: string;
    existingGccOrganizationId?: string;
  };
  governance: {
    autoProvisionAccess: false;
    autoCreateUsers: false;
    autoSendInvites: false;
    observationOnly: true;
    duplicateAtlasCrm: false;
    requiresOwnerApproval: true;
  };
  attribution?: {
    leadId?: string;
    opportunityId?: string;
    assessmentId?: string;
    source?: string;
  };
};

const CLIENT_CODE_RE = /^[A-Z][A-Z0-9]{2,15}$/;

export function assertAtlasGccActivationContract(handoff: AtlasGccActivationHandoff): string[] {
  const issues: string[] = [];
  if (handoff.contractVersion !== ATLAS_GCC_ACTIVATION_CONTRACT) {
    issues.push("Unsupported contract version");
  }
  if (!CLIENT_CODE_RE.test(handoff.client.clientCode)) {
    issues.push("client.clientCode must be a canonical Atlas ClientCode");
  }
  if (handoff.client.clientStage !== "Active Client") {
    issues.push("GCC handoff requires ClientStage=Active Client");
  }
  if (handoff.gcc.action !== "prepare_tenant_mapping") {
    issues.push("GCC handoff may only prepare a tenant mapping");
  }
  if (handoff.governance.autoProvisionAccess !== false) {
    issues.push("autoProvisionAccess must remain false");
  }
  if (handoff.governance.duplicateAtlasCrm !== false) {
    issues.push("GCC must not duplicate Atlas CRM");
  }
  if (!handoff.idempotencyKey.startsWith("gcc-activate|")) {
    issues.push("idempotencyKey must use gcc-activate|{ClientCode}|{event}");
  }
  return issues;
}
