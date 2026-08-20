import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_TENANT_ID,
  PUBLIC_SIGNUP_ENABLED,
  isDemoOrganizationId,
  publicSignupOrganizationId,
  resolveAuthenticatedOrganizationId,
  selectOrganizationId,
} from "./organization.ts";

describe("GCC organization isolation", () => {
  it("never invents org-apex when organization mapping is missing", () => {
    assert.equal(
      resolveAuthenticatedOrganizationId({
        profileOrganizationId: null,
        metadataOrganizationId: null,
      }),
      null
    );
    assert.equal(publicSignupOrganizationId(), null);
    assert.equal(PUBLIC_SIGNUP_ENABLED, false);
    assert.equal(DEMO_TENANT_ID, "org-apex");
  });

  it("prefers profile mapping over metadata and rejects query spoofing", () => {
    assert.equal(
      resolveAuthenticatedOrganizationId({
        profileOrganizationId: "org-summit",
        metadataOrganizationId: DEMO_TENANT_ID,
      }),
      "org-summit"
    );
    const spoof = selectOrganizationId({
      authOrganizationId: "org-summit",
      requestedOrganizationId: DEMO_TENANT_ID,
      role: "founder",
    });
    assert.equal(spoof.denied, true);
    assert.equal(spoof.reason, "organization_mismatch");
    const admin = selectOrganizationId({
      authOrganizationId: "org-summit",
      requestedOrganizationId: DEMO_TENANT_ID,
      role: "platform_admin",
    });
    assert.equal(admin.denied, false);
    assert.equal(admin.organizationId, DEMO_TENANT_ID);
  });

  it("fails closed when an authenticated user has no organization", () => {
    const result = selectOrganizationId({
      authOrganizationId: "",
      requestedOrganizationId: DEMO_TENANT_ID,
      role: "founder",
    });
    assert.equal(result.denied, true);
    assert.equal(result.reason, "organization_mapping_required");
    assert.equal(isDemoOrganizationId(DEMO_TENANT_ID), true);
    assert.equal(isDemoOrganizationId("org-summit"), false);
  });
});
