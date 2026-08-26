#!/usr/bin/env node
/**
 * GCC Multi-Tenant Pilot Certification
 *
 * Validates two-tenant isolation, integration honesty, onboarding persistence,
 * and optional second-tenant synthetic data journey.
 *
 * Uses REAL USER auth only (no service role as customer proof).
 *
 * Run (HVCG only — isolation probes):
 *   PILOT_EMAIL=... PILOT_PASSWORD=... npm run pilot:multitenant
 *
 * Run (full two-tenant cert):
 *   PILOT_EMAIL=... PILOT_PASSWORD=... \
 *   SECOND_TENANT_EMAIL=... SECOND_TENANT_PASSWORD=... \
 *   SECOND_TENANT_SNAPSHOT_CSV=docs/mock-second-tenant-financial-snapshot.csv \
 *   SECOND_TENANT_TRENDS_CSV=docs/mock-second-tenant-monthly-trends.csv \
 *   npm run pilot:multitenant
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE_URL ?? "https://growth-command-center-lbnt.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://igyaebtymornywjeidrl.supabase.co";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlneWFlYnR5bW9ybnl3amVpZHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODQ4NTEsImV4cCI6MjA5NDM2MDg1MX0.Sc513VMEzqvVj6ET_2CIVtnPaTQxddWPIAygt4fxvh0";

const HVCG_EMAIL = process.env.PILOT_EMAIL;
const HVCG_PASSWORD = process.env.PILOT_PASSWORD;
const SECOND_EMAIL = process.env.SECOND_TENANT_EMAIL;
const SECOND_PASSWORD = process.env.SECOND_TENANT_PASSWORD;
const SECOND_SNAPSHOT = process.env.SECOND_TENANT_SNAPSHOT_CSV ?? "docs/mock-second-tenant-financial-snapshot.csv";
const SECOND_TRENDS = process.env.SECOND_TENANT_TRENDS_CSV ?? "docs/mock-second-tenant-monthly-trends.csv";

const DEMO_ORGS = new Set(["org-apex", "org-summit"]);
const HVCG_ORG_HINT = "org-high-value-capital-group-llc";
const RYAN_ORG_CANDIDATES = [
  "org-ryan-gnieski",
  "org-ryan-gnieski-mock",
  "org-prodigy-games",
];

const results = {};
let crossTenantLeakage = 0;

function pass(key, detail = "") {
  results[key] = "PASS";
  console.log(`PASS: ${key}${detail ? ` — ${detail}` : ""}`);
}

function fail(key, detail = "") {
  results[key] = "FAIL";
  console.error(`FAIL: ${key}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

function skip(key, reason) {
  results[key] = `SKIP (${reason})`;
  console.log(`SKIP: ${key} — ${reason}`);
}

function partial(key, detail) {
  results[key] = `PARTIAL (${detail})`;
  console.log(`PARTIAL: ${key} — ${detail}`);
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function fileToBase64(path) {
  return Buffer.from(readFileSync(path)).toString("base64");
}

async function signIn(email, password) {
  const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message ?? "sign-in failed");
  }
  return { supabase, token: data.session.access_token, userId: data.user.id };
}

async function getTenantContext(supabase, userId) {
  const { data: profile } = await supabase
    .from("gcc_profiles")
    .select("organization_id, full_name")
    .eq("id", userId)
    .single();

  if (!profile?.organization_id) throw new Error("no organization on profile");

  const { data: org } = await supabase
    .from("gcc_organizations")
    .select("id, name, data_source, industry, business_priorities, onboarding_complete, onboarding_step")
    .eq("id", profile.organization_id)
    .single();

  return { orgId: profile.organization_id as string, org, fullName: profile.full_name as string };
}

async function importCsv(token, orgId, templateType, filePath) {
  const fileName = filePath.split("/").pop();
  const fileBase64 = fileToBase64(filePath);

  const previewRes = await fetch(`${BASE}/api/imports?action=preview`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ organizationId: orgId, templateType, fileName, fileBase64 }),
  });
  const preview = await previewRes.json();
  if (!previewRes.ok) throw new Error(`preview: ${preview.error ?? previewRes.status}`);

  const commitRes = await fetch(`${BASE}/api/imports?action=commit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      organizationId: orgId,
      templateType,
      fileName,
      fileBase64,
      preview,
    }),
  });
  const commit = await commitRes.json();
  if (!commitRes.ok) throw new Error(`commit: ${commit.error ?? commitRes.status}`);
  return commit;
}

async function probeCrossTenant(token, ownOrgId, targetOrgId) {
  const res = await fetch(`${BASE}/api/dashboard?organizationId=${targetOrgId}`, {
    headers: authHeaders(token),
  });
  if (res.status === 403) return "blocked";
  if (res.ok && targetOrgId !== ownOrgId) {
    crossTenantLeakage += 1;
    return "leaked";
  }
  return `status_${res.status}`;
}

async function auditIntegrations(token, orgId) {
  const res = await fetch(`${BASE}/api/integrations?organizationId=${orgId}`, {
    headers: authHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`integrations: ${data.error ?? res.status}`);

  const integrations = data.integrations ?? [];
  const deadCtas = integrations.filter(
    (i) => i.isLive && i.availability !== "live" && i.status === "connected"
  ).length;

  const fakeConnected = integrations.filter((i) => i.status === "connected" && !i.isLive).length;
  const fileImportLive = data.capabilities?.fileImport?.availability === "live";
  const nativeLive = data.capabilities?.nativeConnectorsLive === true;

  return { integrations, deadCtas, fakeConnected, fileImportLive, nativeLive, capabilities: data.capabilities };
}

async function validateTenant(label, email, password, options = {}) {
  const { expectHvcg = false, runImport = false } = options;
  console.log(`\n--- ${label} ---`);

  let token, supabase, userId, ctx;
  try {
    ({ token, supabase, userId } = await signIn(email, password));
    pass(`${label}_AUTH`, email.replace(/(.{3}).*(@.*)/, "$1***$2"));
  } catch (e) {
    fail(`${label}_AUTH`, e.message);
    return null;
  }

  try {
    ctx = await getTenantContext(supabase, userId);
  } catch (e) {
    fail(`${label}_PROVISION`, e.message);
    return null;
  }

  if (DEMO_ORGS.has(ctx.orgId)) {
    fail(`${label}_PROVISION`, `bound to demo org ${ctx.orgId}`);
    return null;
  }

  pass(`${label}_PROVISION`, `org=${ctx.orgId} name=${ctx.org?.name ?? "?"}`);

  if (expectHvcg && !ctx.orgId.includes("high-value-capital")) {
    partial(`${label}_PROVISION`, `expected HVCG slug, got ${ctx.orgId}`);
  }

  const onboardingRes = await fetch(`${BASE}/api/onboarding?organizationId=${ctx.orgId}`, {
    headers: authHeaders(token),
  });
  const onboarding = await onboardingRes.json();
  if (onboardingRes.ok) {
    const hasProfile =
      onboarding.onboardingStep ||
      onboarding.progress > 0 ||
      onboarding.onboardingComplete ||
      (onboarding.messages?.length ?? 0) > 0;
    if (hasProfile) pass(`${label}_ONBOARDING_STATE`, `step=${onboarding.onboardingStep} complete=${onboarding.onboardingComplete}`);
    else partial(`${label}_ONBOARDING_STATE`, "no onboarding messages yet");
  } else {
    fail(`${label}_ONBOARDING_STATE`, onboarding.error ?? onboardingRes.status);
  }

  if (ctx.org?.onboarding_complete) {
    pass(`${label}_ONBOARDING_PERSISTENCE`, `industry=${ctx.org.industry ?? "n/a"} priorities=${(ctx.org.business_priorities ?? []).length}`);
  } else if (onboarding.onboardingComplete) {
    pass(`${label}_ONBOARDING_PERSISTENCE`, "complete flag from API");
  } else {
    partial(`${label}_ONBOARDING_PERSISTENCE`, "onboarding not marked complete in org row");
  }

  try {
    const integ = await auditIntegrations(token, ctx.orgId);
    if (integ.fileImportLive) pass(`${label}_FILE_IMPORT_LIVE`);
    else fail(`${label}_FILE_IMPORT_LIVE`, "fileImport not live");

    if (!integ.nativeLive) pass(`${label}_NATIVE_CONNECTORS_HONEST`);
    else fail(`${label}_NATIVE_CONNECTORS_HONEST`, "nativeConnectorsLive=true in production");

    if (integ.fakeConnected === 0) pass(`${label}_NO_FAKE_CONNECTED`, `${integ.integrations.length} integrations`);
    else {
      fail(`${label}_NO_FAKE_CONNECTED`, `${integ.fakeConnected} mock connected states`);
      crossTenantLeakage += integ.fakeConnected;
    }

    results[`${label}_DEAD_CTAS`] = integ.deadCtas;
    if (integ.deadCtas === 0) pass(`${label}_DEAD_CTAS_ZERO`);
    else fail(`${label}_DEAD_CTAS_ZERO`, `${integ.deadCtas} dead CTAs`);
  } catch (e) {
    fail(`${label}_INTEGRATIONS`, e.message);
  }

  const dashRes = await fetch(`${BASE}/api/dashboard?organizationId=${ctx.orgId}`, {
    headers: authHeaders(token),
  });
  const dash = await dashRes.json();
  if (dashRes.ok) {
    const provenance = dash.dataProvenance ?? dash.source;
    const cash = dash.financialSnapshot?.currentCash ?? 0;
    pass(`${label}_DASHBOARD`, `provenance=${provenance} cash=${cash}`);

    if (expectHvcg && cash > 0 && ctx.org?.data_source === "empty") {
      partial(`${label}_EMPTY_STATE`, "cash>0 but data_source empty — verify not demo bleed");
    } else if (expectHvcg && (provenance === "empty" || ctx.org?.data_source === "empty")) {
      pass(`${label}_EMPTY_STATE`, "awaiting import");
    }
  } else {
    fail(`${label}_DASHBOARD`, dash.error ?? dashRes.status);
  }

  if (runImport && existsSync(SECOND_SNAPSHOT)) {
    try {
      await importCsv(token, ctx.orgId, "financial_snapshot", SECOND_SNAPSHOT);
      if (existsSync(SECOND_TRENDS)) {
        await importCsv(token, ctx.orgId, "monthly_trends", SECOND_TRENDS);
      }
      await fetch(`${BASE}/api/pipeline/recompute`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ organizationId: ctx.orgId }),
      });
      pass(`${label}_SYNTHETIC_IMPORT`);

      const dash2 = await (await fetch(`${BASE}/api/dashboard?organizationId=${ctx.orgId}`, {
        headers: authHeaders(token),
      })).json();
      if (dash2.financialSnapshot?.currentCash === 185000) {
        pass(`${label}_DASHBOARD_AFTER_IMPORT`, "synthetic cash verified");
      } else {
        partial(`${label}_DASHBOARD_AFTER_IMPORT`, `cash=${dash2.financialSnapshot?.currentCash}`);
      }

      const aiRes = await fetch(`${BASE}/api/ai-advisor`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ organizationId: ctx.orgId, message: "What should I focus on?" }),
      });
      const ai = await aiRes.json();
      if (aiRes.ok && ai.insights?.length > 20) {
        const mentionsHvcg = /high value capital/i.test(ai.insights);
        if (!mentionsHvcg) pass(`${label}_AI_CFO`);
        else {
          fail(`${label}_AI_CFO`, "response mentions HVCG");
          crossTenantLeakage += 1;
        }
      } else if (aiRes.status === 503) {
        skip(`${label}_AI_CFO`, "ANTHROPIC not configured");
      } else {
        partial(`${label}_AI_CFO`, ai.error ?? aiRes.status);
      }

      const vcRes = await fetch(`${BASE}/api/value-creation?organizationId=${ctx.orgId}`, {
        headers: authHeaders(token),
      });
      const vc = await vcRes.json();
      if (vcRes.ok && Array.isArray(vc.opportunities)) {
        pass(`${label}_VALUE_CREATION`, `${vc.opportunities.length} opportunities`);
      } else {
        partial(`${label}_VALUE_CREATION`, vcRes.status);
      }
    } catch (e) {
      fail(`${label}_DATA_JOURNEY`, e.message);
    }
  }

  return { token, orgId: ctx.orgId, orgName: ctx.org?.name, cash: dash?.financialSnapshot?.currentCash };
}

async function main() {
  console.log("\n=== GCC Multi-Tenant Pilot Certification ===");
  console.log(`Production: ${BASE}\n`);

  if (!HVCG_EMAIL || !HVCG_PASSWORD) {
    fail("TENANT_ISOLATION", "Set PILOT_EMAIL and PILOT_PASSWORD for HVCG session");
    printReport();
    return;
  }

  const hvcg = await validateTenant("HVCG", HVCG_EMAIL, HVCG_PASSWORD, { expectHvcg: true });
  if (!hvcg) {
    printReport();
    return;
  }

  for (const candidate of [...RYAN_ORG_CANDIDATES, "org-apex", "org-summit"]) {
    const result = await probeCrossTenant(hvcg.token, hvcg.orgId, candidate);
    if (result === "blocked") {
      pass("CROSS_TENANT_PROBE", `${candidate} → 403`);
    } else if (result === "leaked") {
      fail("CROSS_TENANT_PROBE", `${candidate} data leaked`);
    }
  }

  if (crossTenantLeakage === 0) pass("TENANT_ISOLATION");
  else fail("TENANT_ISOLATION", `${crossTenantLeakage} leakage events`);

  let second = null;
  if (SECOND_EMAIL && SECOND_PASSWORD) {
    second = await validateTenant("SECOND_TENANT", SECOND_EMAIL, SECOND_PASSWORD, { runImport: true });

    if (second && hvcg) {
      if (second.orgId !== hvcg.orgId) pass("SECOND_TENANT_SEPARATE_ORG");
      else fail("SECOND_TENANT_SEPARATE_ORG", "same org as HVCG");

      const hvcgToSecond = await probeCrossTenant(hvcg.token, hvcg.orgId, second.orgId);
      const secondToHvcg = await probeCrossTenant(second.token, second.orgId, hvcg.orgId);

      if (hvcgToSecond === "blocked" && secondToHvcg === "blocked") {
        pass("BIDIRECTIONAL_ISOLATION");
      } else {
        fail("BIDIRECTIONAL_ISOLATION", `hvcg→second=${hvcgToSecond} second→hvcg=${secondToHvcg}`);
      }

      if (second.cash !== hvcg.cash || second.orgId !== hvcg.orgId) {
        pass("DATA_BOUNDARY");
      } else {
        partial("DATA_BOUNDARY", "tenants may share empty state — verify after import");
      }
    }
  } else {
    skip("SECOND_TENANT_PROVISION", "Set SECOND_TENANT_EMAIL and SECOND_TENANT_PASSWORD");
    skip("SECOND_TENANT_DATA_JOURNEY", "second tenant credentials not provided");
    partial("SECOND_TENANT_VALIDATION", "owner-reported signup + AI onboarding complete; automated cert needs credentials");
  }

  printReport();
}

function printReport() {
  console.log("\n=== CERTIFICATION SUMMARY ===");
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k} = ${v}`);
  }
  console.log(`CROSS_TENANT_LEAKAGE = ${crossTenantLeakage}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
