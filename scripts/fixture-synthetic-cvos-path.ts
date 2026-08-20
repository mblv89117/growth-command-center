import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { syntheticActivationHandoff, mapActivationToClientContext } from "../src/lib/cvos/client-context.ts";
import { buildExecutiveCockpit } from "../src/lib/cvos/cockpit.ts";
import { detectSignals } from "../src/lib/cvos/signals.ts";
import { toGccValueSignal, capitalToGccValueSignal, assertGccValueSignal } from "../src/lib/cvos/value-signal-adapter.ts";
import { SYNTHETIC_ORG_ID, SYNTHETIC_CLIENT_CODE } from "../src/lib/cvos/synthetic.ts";

const steps: string[] = [];
function step(name: string, detail: string) {
  steps.push(`✓ ${name}: ${detail}`);
  console.log(`✓ ${name}: ${detail}`);
}

const activation = syntheticActivationHandoff();
assert.equal(activation.governance.autoProvisionAccess, false);
step("activation_handoff", `contract=${activation.contractVersion} autoProvisionAccess=false`);

const mapped = mapActivationToClientContext({ activation, gccOrganizationId: SYNTHETIC_ORG_ID });
assert.equal(mapped.ok, true);
if (!mapped.ok) throw new Error(mapped.issues.join("; "));
assert.equal(mapped.context.gccOrganizationId, SYNTHETIC_ORG_ID);
assert.notEqual(mapped.context.gccOrganizationId, "org-apex");
step("client_context", `org=${mapped.context.gccOrganizationId} kpis=${mapped.context.approvedKpis.length}`);

const cockpit = buildExecutiveCockpit(SYNTHETIC_ORG_ID);
assert.ok(cockpit);
assert.ok((cockpit?.kpis.length ?? 0) >= 4);
step("cockpit_kpis", `kpis=${cockpit!.kpis.length} exceptions=${cockpit!.exceptions.length}`);

const { signals, capital } = detectSignals(SYNTHETIC_ORG_ID);
const valueSignals = [...signals.map(toGccValueSignal), ...capital.map(capitalToGccValueSignal)];
for (const vs of valueSignals) assert.deepEqual(assertGccValueSignal(vs), []);
step("value_signals", `count=${valueSignals.length} canonical=gcc-value-signal.v1`);

mkdirSync("/opt/cursor/artifacts", { recursive: true });
writeFileSync(
  "/opt/cursor/artifacts/gcc_d25_synthetic_fixture_path.json",
  JSON.stringify({
    directive: 25,
    path: "activation→context→cockpit→gcc-value-signal.v1",
    organizationId: SYNTHETIC_ORG_ID,
    clientCode: SYNTHETIC_CLIENT_CODE,
    autoProvisionAccess: false,
    liveAtlasDispatch: false,
    liveSupabaseMigration: false,
    steps,
    valueSignalSample: valueSignals[0],
  }, null, 2),
);
console.log("FIXTURE_PATH_PASS");
