import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ATLAS_GCC_ACTIVATION_CONTRACT,
  assertAtlasGccActivationContract,
  type AtlasGccActivationHandoff,
} from "./atlas-activation.ts";

function validHandoff(): AtlasGccActivationHandoff {
  return {
    contractVersion: ATLAS_GCC_ACTIVATION_CONTRACT,
    source: {
      product: "atlas-hub",
      system: "HVCG_Clients",
      technology: "project-atlas",
    },
    emittedAt: "2026-08-20T00:00:00.000Z",
    idempotencyKey: "gcc-activate|SYN01|verified",
    client: {
      clientCode: "SYN01",
      displayName: "SYNTHETIC QA — Atlas Capital Operations",
      clientStage: "Active Client",
    },
    activation: {
      activatedAt: "2026-08-20T00:00:00.000Z",
      activatedBy: "e4835ea2-3c45-493a-95f5-472f6339661d",
      activationReason: "Governed Atlas activation",
      relatedOpportunityId: "4",
    },
    gcc: {
      action: "prepare_tenant_mapping",
      suggestedTenantSlug: "syn01",
    },
    governance: {
      autoProvisionAccess: false,
      autoCreateUsers: false,
      autoSendInvites: false,
      observationOnly: true,
      duplicateAtlasCrm: false,
      requiresOwnerApproval: true,
    },
  };
}

describe("Atlas → GCC activation handoff contract", () => {
  it("accepts a SYN01 Active Client observation-only payload", () => {
    assert.deepEqual(assertAtlasGccActivationContract(validHandoff()), []);
  });

  it("rejects Lead-stage clients, CRM duplication, and auto-provision", () => {
    const lead = validHandoff();
    lead.client.clientStage = "Lead" as AtlasGccActivationHandoff["client"]["clientStage"];
    assert.ok(assertAtlasGccActivationContract(lead).includes("GCC handoff requires ClientStage=Active Client"));

    const dup = validHandoff();
    dup.governance.duplicateAtlasCrm = true as false;
    assert.ok(assertAtlasGccActivationContract(dup).includes("GCC must not duplicate Atlas CRM"));

    const auto = validHandoff();
    auto.governance.autoProvisionAccess = true as false;
    assert.ok(assertAtlasGccActivationContract(auto).includes("autoProvisionAccess must remain false"));
  });

  it("requires gcc-activate idempotency and a canonical ClientCode", () => {
    const key = validHandoff();
    key.idempotencyKey = "activate|SYN01";
    assert.ok(
      assertAtlasGccActivationContract(key).includes("idempotencyKey must use gcc-activate|{ClientCode}|{event}"),
    );

    const code = validHandoff();
    code.client.clientCode = "accg01";
    assert.ok(assertAtlasGccActivationContract(code).includes("client.clientCode must be a canonical Atlas ClientCode"));
  });
});
