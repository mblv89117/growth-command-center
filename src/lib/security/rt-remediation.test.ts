import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createSignedQuickBooksState,
  verifySignedQuickBooksState,
} from "../integrations/oauth-state.ts";
import { hasPermission } from "../auth/permissions.ts";
import {
  signAtlasHandoffBody,
  verifyAtlasHandoffAttestation,
} from "../handoff/attestation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("GCC-RT security remediations", () => {
  it("GCC-RT-01: signup trigger never COALESCE to org-apex or trusts metadata role/org", () => {
    const setup = readFileSync(join(root, "supabase/setup.sql"), "utf8");
    assert.match(setup, /gcc_handle_new_user/);
    assert.doesNotMatch(
      setup,
      /COALESCE\(NEW\.raw_user_meta_data->>'organization_id',\s*'org-apex'\)/,
    );
    assert.match(setup, /'staff',\s*\n\s*NULL/);
    assert.doesNotMatch(setup, /COALESCE\(NEW\.raw_user_meta_data->>'role'/);
  });

  it("GCC-RT-02: profile update policy freezes role and organization_id", () => {
    const setup = readFileSync(join(root, "supabase/setup.sql"), "utf8");
    assert.match(setup, /gcc_prevent_profile_privilege_escalation/);
    assert.match(setup, /organization_id IS NOT DISTINCT FROM/);
    assert.match(setup, /role = \(SELECT p\.role FROM gcc_profiles/);
  });

  it("GCC-RT-03: signed OAuth state rejects tampering and expiry", () => {
    process.env.QUICKBOOKS_STATE_SECRET = "test-secret-for-rt-03";
    const state = createSignedQuickBooksState({
      organizationId: "org-victim",
      userId: "user-1",
      nowMs: 1_000_000,
    });
    const ok = verifySignedQuickBooksState(state, { userId: "user-1", nowMs: 1_000_100 });
    assert.equal(ok.organizationId, "org-victim");

    assert.throws(
      () =>
        verifySignedQuickBooksState(state.slice(0, -2) + "aa", {
          userId: "user-1",
          nowMs: 1_000_100,
        }),
      /tampered|invalid/,
    );
    assert.throws(
      () =>
        verifySignedQuickBooksState(state, {
          userId: "user-1",
          nowMs: 1_000_000 + 16 * 60 * 1000,
        }),
      /expired/,
    );
    assert.throws(
      () => verifySignedQuickBooksState(state, { userId: "user-other", nowMs: 1_000_100 }),
      /user_mismatch/,
    );

    const unsigned = Buffer.from(JSON.stringify({ organizationId: "org-victim" })).toString(
      "base64url",
    );
    assert.throws(() => verifySignedQuickBooksState(unsigned), /invalid_oauth_state/);
  });

  it("GCC-RT-06: sales lacks financials:read and reports:export", () => {
    assert.equal(hasPermission("sales", "financials:read"), false);
    assert.equal(hasPermission("sales", "reports:export"), false);
    assert.equal(hasPermission("sales", "dashboard:read"), true);
    const tenantRoute = readFileSync(join(root, "src/app/api/tenant/route.ts"), "utf8");
    assert.match(tenantRoute, /requirePermission\(access,\s*"financials:read"\)/);
    const exportRoute = readFileSync(join(root, "src/app/api/reports/export/route.ts"), "utf8");
    assert.match(exportRoute, /requirePermission\(access,\s*"reports:export"\)/);
  });

  it("GCC-RT-07: unsigned Atlas handoff attestation is rejected; valid HMAC accepted", () => {
    const secret = "test-atlas-gcc-handoff-hmac";
    const rawBody = JSON.stringify({ contractVersion: "atlas-gcc-client-activation.v1" });
    const ts = 1_700_000_000;
    const missing = verifyAtlasHandoffAttestation({
      rawBody,
      timestampHeader: null,
      signatureHeader: null,
      secret,
      nowSec: ts,
    });
    assert.equal(missing.ok, false);

    const bad = verifyAtlasHandoffAttestation({
      rawBody,
      timestampHeader: String(ts),
      signatureHeader: "deadbeef",
      secret,
      nowSec: ts,
    });
    assert.equal(bad.ok, false);

    const sig = signAtlasHandoffBody(rawBody, ts, secret);
    const ok = verifyAtlasHandoffAttestation({
      rawBody,
      timestampHeader: String(ts),
      signatureHeader: sig,
      secret,
      nowSec: ts,
    });
    assert.equal(ok.ok, true);

    const handoffRoute = readFileSync(
      join(root, "src/app/api/handoff/atlas-activation/route.ts"),
      "utf8",
    );
    assert.match(handoffRoute, /verifyAtlasHandoffAttestation/);
    assert.match(handoffRoute, /handoff_attestation_required/);
  });

  it("GCC-RT-05: tenant/dashboard/export derive org from session helpers", () => {
    for (const rel of [
      "src/app/api/tenant/route.ts",
      "src/app/api/dashboard/route.ts",
      "src/app/api/reports/export/route.ts",
      "src/lib/api/secure-access.ts",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      assert.match(src, /selectOrganizationId/);
      assert.match(src, /authOrganizationId:\s*access\.organizationId/);
    }
  });
});
