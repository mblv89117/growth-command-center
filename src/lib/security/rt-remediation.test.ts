import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createSignedQuickBooksState,
  verifySignedQuickBooksState,
} from "../integrations/oauth-state.ts";

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

    assert.throws(() => verifySignedQuickBooksState(state.slice(0, -2) + "aa", { userId: "user-1", nowMs: 1_000_100 }), /tampered|invalid/);
    assert.throws(
      () => verifySignedQuickBooksState(state, { userId: "user-1", nowMs: 1_000_000 + 16 * 60 * 1000 }),
      /expired/,
    );
    assert.throws(() => verifySignedQuickBooksState(state, { userId: "user-other", nowMs: 1_000_100 }), /user_mismatch/);

    const unsigned = Buffer.from(JSON.stringify({ organizationId: "org-victim" })).toString("base64url");
    assert.throws(() => verifySignedQuickBooksState(unsigned), /invalid_oauth_state/);
  });
});
