import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertClientContextContract,
  mapActivationToClientContext,
  syntheticActivationHandoff,
} from "./client-context.ts";
import { buildExecutiveCockpit, sumVerifiedFinancialImpact } from "./cockpit.ts";
import { assertNoFabricatedFinance, buildValueCreationBoard } from "./value-creation.ts";
import { approveExecutiveBrief, canDeliverExternally, getExecutiveBrief } from "./executive-brief.ts";
import {
  assertCapitalSignalGovernance,
  assertGtmFeedbackSafe,
  detectSignals,
  getGtmFeedback,
} from "./signals.ts";
import {
  assertGccValueSignal,
  capitalToGccValueSignal,
  toGccValueSignal,
} from "./value-signal-adapter.ts";
import { SYNTHETIC_ORG_ID, SYN01_VALUE_INITIATIVES } from "./synthetic.ts";

describe("CVOS synthetic client journey", () => {
  it("maps Atlas Active Client activation → GCC client context without provisioning", () => {
    const activation = syntheticActivationHandoff();
    const mapped = mapActivationToClientContext({
      activation,
      gccOrganizationId: SYNTHETIC_ORG_ID,
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.deepEqual(assertClientContextContract(mapped.context), []);
    assert.equal(mapped.context.clientCode, "SYN01");
    assert.equal(mapped.context.gccOrganizationId, SYNTHETIC_ORG_ID);
    assert.ok(mapped.context.approvedKpis.length >= 3);
    assert.ok(mapped.context.ninetyDayPriorities.length >= 3);
    assert.equal(activation.governance.autoProvisionAccess, false);
  });

  it("builds populated executive cockpit with exceptions, KPIs, value, decisions", () => {
    const cockpit = buildExecutiveCockpit(SYNTHETIC_ORG_ID);
    assert.ok(cockpit);
    assert.equal(cockpit?.source, "synthetic");
    assert.ok((cockpit?.exceptions.length ?? 0) >= 4);
    assert.ok((cockpit?.kpis.length ?? 0) >= 4);
    assert.ok((cockpit?.decisions.length ?? 0) >= 1);
    assert.ok((cockpit?.valueInitiatives.length ?? 0) >= 3);
    assert.equal(cockpit?.cashWeeks.length, 13);
    assert.ok(cockpit?.narrative.nextAction.includes("early-pay"));
  });

  it("never fabricates financial improvement on INFERRED initiatives", () => {
    assert.deepEqual(assertNoFabricatedFinance(SYN01_VALUE_INITIATIVES), []);
    const verified = sumVerifiedFinancialImpact(SYN01_VALUE_INITIATIVES);
    assert.equal(verified, 186000);
    const board = buildValueCreationBoard(SYNTHETIC_ORG_ID);
    assert.equal(board?.verifiedFinancialImpact, 186000);
    assert.ok((board?.inferredCount ?? 0) >= 1);
  });

  it("drafts monthly brief requiring human approval before external delivery", () => {
    const brief = getExecutiveBrief(SYNTHETIC_ORG_ID);
    assert.ok(brief);
    assert.equal(brief?.status, "pending_approval");
    assert.equal(canDeliverExternally(brief!.status), false);
    const approved = approveExecutiveBrief(brief!, "qa@hvcg.test");
    assert.ok(!("error" in approved));
    if ("error" in approved) return;
    assert.equal(approved.status, "approved");
    assert.equal(canDeliverExternally(approved.status), true);
  });

  it("stages renewal/expansion and capital signals for Atlas without lender outreach", () => {
    const { signals, capital } = detectSignals(SYNTHETIC_ORG_ID);
    assert.ok(signals.some((s) => s.kind === "high_realized_value"));
    assert.ok(signals.some((s) => s.kind === "new_capital_need"));
    assert.ok(signals.some((s) => s.kind === "expansion_ready"));
    assert.equal(capital.length, 1);
    assert.deepEqual(assertCapitalSignalGovernance(capital[0]), []);
    assert.equal(capital[0].lenderOutreachAllowed, false);
  });

  it("CC-006: adapts local signals to Integration SoT gcc-value-signal.v1", () => {
    const { signals, capital } = detectSignals(SYNTHETIC_ORG_ID);
    const adapted = signals.map(toGccValueSignal).filter(Boolean);
    assert.ok(adapted.length >= 3);
    for (const vs of adapted) {
      assert.deepEqual(assertGccValueSignal(vs!), []);
      assert.equal(vs!.contractVersion, "gcc-value-signal.v1");
      assert.equal(vs!.copiesLedger, false);
    }
    const cap = capitalToGccValueSignal(capital[0]);
    assert.deepEqual(assertGccValueSignal(cap), []);
    assert.equal(cap.metrics?.lenderOutreachAllowed, false);
  });

  it("emits aggregated GTM feedback without sensitive financials", () => {
    const feedback = getGtmFeedback(SYNTHETIC_ORG_ID);
    assert.ok(feedback);
    assert.deepEqual(assertGtmFeedbackSafe(feedback!), []);
    assert.equal(feedback?.sensitiveFinancialExcluded, true);
  });

  it("fails closed for unmapped tenants", () => {
    assert.equal(buildExecutiveCockpit("org-unknown"), null);
    assert.equal(buildValueCreationBoard("org-unknown"), null);
    assert.equal(getExecutiveBrief("org-unknown"), null);
    assert.deepEqual(detectSignals("org-unknown"), { signals: [], capital: [] });
  });
});
