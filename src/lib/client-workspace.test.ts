import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ClientWorkspaceError,
  assertClientWorkspaceAccess,
  gccWorkspaceKey,
  isolateTenantPayload,
  isGccClientCode,
} from "./client-workspace.ts";

describe("GCC client workspace isolation", () => {
  it("accepts canonical ClientCodes and rejects wildcards", () => {
    assert.equal(isGccClientCode("SYNQA01"), true);
    assert.equal(isGccClientCode("SYNQB02"), true);
    assert.equal(isGccClientCode("*"), false);
    assert.equal(isGccClientCode("synqa01"), false);
    assert.equal(gccWorkspaceKey("SYNQA01"), "gcc-SYNQA01");
  });

  it("fail-closes when Client A requests Client B", () => {
    assert.equal(assertClientWorkspaceAccess("SYNQA01", "SYNQA01"), "SYNQA01");
    assert.equal(assertClientWorkspaceAccess("SYNQA01", null), "SYNQA01");
    assert.throws(
      () => assertClientWorkspaceAccess("SYNQA01", "SYNQB02"),
      (err: unknown) => err instanceof ClientWorkspaceError && err.status === 403
    );
    assert.throws(
      () => assertClientWorkspaceAccess("SYNQA01", "*"),
      (err: unknown) => err instanceof ClientWorkspaceError && err.status === 403
    );
    assert.throws(
      () => assertClientWorkspaceAccess(undefined, "SYNQA01"),
      (err: unknown) => err instanceof ClientWorkspaceError && err.status === 403
    );
  });

  it("stamps isolated GCC payloads with the caller ClientCode only", () => {
    const isolated = isolateTenantPayload({ organizationId: "org-apex" }, "SYNQA01");
    assert.equal(isolated.clientCode, "SYNQA01");
    assert.equal(isolated.gccWorkspaceKey, "gcc-SYNQA01");
    assert.equal(isolated.isolated, true);
    assert.equal(JSON.stringify(isolated).includes("SYNQB02"), false);
  });
});
