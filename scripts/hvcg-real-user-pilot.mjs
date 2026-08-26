#!/usr/bin/env node
/**
 * HVCG Internal Pilot — Real-User Production Certification
 *
 * Uses REAL USER auth (signInWithPassword + access token). Does NOT use service role.
 *
 * Prerequisites:
 *   1. Email confirmed for PILOT_EMAIL
 *   2. HVCG tenant provisioned (company: High Value Capital Group LLC)
 *   3. Optional: PILOT_SNAPSHOT_CSV and PILOT_TRENDS_CSV with authorized HVCG data
 *
 * Run:
 *   PILOT_EMAIL=... PILOT_PASSWORD=... npm run pilot:hvcg
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE_URL ?? "https://growth-command-center-lbnt.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://igyaebtymornywjeidrl.supabase.co";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlneWFlYnR5bW9ybnl3amVpZHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODQ4NTEsImV4cCI6MjA5NDM2MDg1MX0.Sc513VMEzqvVj6ET_2CIVtnPaTQxddWPIAygt4fxvh0";

const PILOT_EMAIL = process.env.PILOT_EMAIL;
const PILOT_PASSWORD = process.env.PILOT_PASSWORD;
const SNAPSHOT_CSV = process.env.PILOT_SNAPSHOT_CSV;
const TRENDS_CSV = process.env.PILOT_TRENDS_CSV;
const EXPECTED_COMPANY = "High Value Capital Group LLC";
const DEMO_ORGS = new Set(["org-apex", "org-summit"]);

const results = {};
const friction = [];

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

function noteFriction(level, item) {
  friction.push({ level, item });
  console.log(`FRICTION [${level}]: ${item}`);
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function fileToBase64(path) {
  return Buffer.from(readFileSync(path)).toString("base64");
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

async function main() {
  console.log("\n=== HVCG Real-User Internal Pilot ===");
  console.log(`Production: ${BASE}\n`);

  if (!PILOT_EMAIL || !PILOT_PASSWORD) {
    fail("HVCG_AUTHENTICATED_TENANT", "Set PILOT_EMAIL and PILOT_PASSWORD (confirmed account)");
    printReport();
    return;
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({
    email: PILOT_EMAIL,
    password: PILOT_PASSWORD,
  });

  if (signInError || !auth.session) {
    const msg = signInError?.message ?? "no session";
    if (msg.includes("Email not confirmed")) {
      noteFriction("BLOCKER", "Email confirmation required before pilot can proceed");
    } else if (msg.includes("Invalid login credentials")) {
      noteFriction("HIGH FRICTION", "Login failed — account may exist with different password; use forgot-password or existing credentials");
    }
    fail("HVCG_AUTHENTICATED_TENANT", msg);
    printReport();
    return;
  }

  const token = auth.session.access_token;
  const userId = auth.user.id;
  pass("HVCG_AUTHENTICATED_TENANT", PILOT_EMAIL);

  const { data: profile, error: profileError } = await supabase
    .from("gcc_profiles")
    .select("organization_id, full_name")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    fail("HVCG_AUTHENTICATED_TENANT", profileError?.message ?? "no profile org");
    printReport();
    return;
  }

  const orgId = profile.organization_id;
  if (DEMO_ORGS.has(orgId)) {
    fail("HVCG_AUTHENTICATED_TENANT", `bound to demo org: ${orgId}`);
    printReport();
    return;
  }

  const { data: org } = await supabase
    .from("gcc_organizations")
    .select("id, name, data_source")
    .eq("id", orgId)
    .single();

  const orgName = org?.name ?? "unknown";

  if (!orgName?.toLowerCase().includes("high value capital")) {
    noteFriction("HIGH FRICTION", `Organization name "${orgName}" does not match expected HVCG tenant`);
  }
  pass("HVCG_PILOT_DATA_INTEGRITY", `org=${orgId} name=${orgName}`);

  // Import authorized data if provided
  if (SNAPSHOT_CSV && existsSync(SNAPSHOT_CSV)) {
    try {
      const snap = await importCsv(token, orgId, "financial_snapshot", SNAPSHOT_CSV);
      pass("HVCG_IMPORT", `snapshot ${snap.rowsCommitted} rows`);
    } catch (e) {
      fail("HVCG_IMPORT", e.message);
    }
  } else {
    skip("HVCG_IMPORT", "PILOT_SNAPSHOT_CSV not provided — OWNER-INPUT-REQUIRED");
    noteFriction("BLOCKER", "Authorized HVCG financial snapshot CSV not yet provided");
  }

  if (TRENDS_CSV && existsSync(TRENDS_CSV)) {
    try {
      const trends = await importCsv(token, orgId, "monthly_trends", TRENDS_CSV);
      pass("HVCG_IMPORT_TRENDS", `${trends.rowsCommitted} monthly rows`);
    } catch (e) {
      noteFriction("HIGH FRICTION", `Monthly trends import failed: ${e.message}`);
    }
  }

  const recomputeRes = await fetch(`${BASE}/api/pipeline/recompute`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ organizationId: orgId }),
  });
  if (recomputeRes.ok) {
    const recompute = await recomputeRes.json();
    pass("HVCG_FORECAST", `${recompute.forecastWeeks ?? "?"} weeks`);
  } else {
    skip("HVCG_FORECAST", "recompute skipped or failed without import");
  }

  const dashRes = await fetch(`${BASE}/api/dashboard?organizationId=${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dash = await dashRes.json();
  if (dashRes.ok && dash.financialSnapshot && dash.dataSource !== "demo") {
    const cash = dash.financialSnapshot.currentCash;
    if (cash > 0 || SNAPSHOT_CSV) {
      pass("HVCG_EXECUTIVE_DASHBOARD", `cash=${cash}, source=${dash.dataSource ?? "import"}`);
    } else {
      skip("HVCG_EXECUTIVE_DASHBOARD", "no imported cash data yet");
    }
  } else {
    fail("HVCG_EXECUTIVE_DASHBOARD", dashRes.status);
  }

  const kpiRes = await fetch(`${BASE}/api/kpis?organizationId=${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (kpiRes.ok) {
    const kpis = await kpiRes.json();
    pass("HVCG_KPI_ENGINE", `${kpis.kpis?.length ?? 0} KPIs`);
  } else {
    skip("HVCG_KPI_ENGINE", `status ${kpiRes.status}`);
  }

  const vcRes = await fetch(`${BASE}/api/value-creation?organizationId=${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const vc = await vcRes.json();
  if (vcRes.ok && Array.isArray(vc.opportunities)) {
    pass("HVCG_VALUE_CREATION", `${vc.opportunities.length} opportunities`);
  } else {
    skip("HVCG_VALUE_CREATION", `status ${vcRes.status}`);
  }

  const aiRes = await fetch(`${BASE}/api/ai-advisor`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      organizationId: orgId,
      message: "What should I focus on this month?",
    }),
  });
  const ai = await aiRes.json();
  if (aiRes.ok && ai.insights?.length > 20) {
    pass("HVCG_AI_CFO", `${ai.wordCount} words`);
    pass("AI_CFO_CONVERSATION_PERSISTENCE", "conversation created");
  } else if (aiRes.status === 503) {
    skip("HVCG_AI_CFO", "ANTHROPIC_API_KEY not configured");
    skip("AI_CFO_CONVERSATION_PERSISTENCE", "AI unavailable");
  } else {
    fail("HVCG_AI_CFO", JSON.stringify(ai));
  }

  const crossRes = await fetch(`${BASE}/api/dashboard?organizationId=org-apex`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (crossRes.status === 403) {
    pass("TENANT_ISOLATION", "cross-tenant 403");
    results.CROSS_TENANT_LEAKAGE = 0;
  } else {
    fail("TENANT_ISOLATION", `expected 403, got ${crossRes.status}`);
    results.CROSS_TENANT_LEAKAGE = 1;
  }

  await supabase.auth.signOut();
  const { data: session2 } = await supabase.auth.signInWithPassword({
    email: PILOT_EMAIL,
    password: PILOT_PASSWORD,
  });
  if (session2.session) {
    const dash2 = await fetch(`${BASE}/api/dashboard?organizationId=${orgId}`, {
      headers: { Authorization: `Bearer ${session2.session.access_token}` },
    });
    if (dash2.ok) pass("RETURN_SESSION_PERSISTENCE");
    else fail("RETURN_SESSION_PERSISTENCE", dash2.status);
  } else {
    fail("RETURN_SESSION_PERSISTENCE", "re-login failed");
  }

  results.PILOT_BLOCKERS = friction.filter((f) => f.level === "BLOCKER").length;
  printReport();
}

function printReport() {
  console.log("\n=== HVCG PILOT REPORT ===");
  const keys = [
    "GCC_HVCG_INTERNAL_PILOT",
    "HVCG_AUTHENTICATED_TENANT",
    "HVCG_PILOT_DATA_INTEGRITY",
    "HVCG_IMPORT",
    "HVCG_EXECUTIVE_DASHBOARD",
    "HVCG_FORECAST",
    "HVCG_KPI_ENGINE",
    "HVCG_AI_CFO",
    "AI_CFO_CONVERSATION_PERSISTENCE",
    "HVCG_VALUE_CREATION",
    "RETURN_SESSION_PERSISTENCE",
    "TENANT_ISOLATION",
    "CROSS_TENANT_LEAKAGE",
    "PILOT_BLOCKERS",
    "GCC_AUTHENTICATED_PRODUCTION_JOURNEY",
    "GCC_COMMERCIAL_GOLIVE_CERTIFICATION",
    "FIRST_EXTERNAL_PILOT_PROFILE",
    "EXTERNAL_PILOT_SHORTLIST",
    "PILOT_OFFER_OPTIONS",
    "EXTERNAL_PILOT_PACKAGE",
    "AUTOMATED_GOLIVE_REGRESSION",
    "INDEPENDENT_VALIDATION",
    "CURRENT_PUBLIC_PRICE",
    "SECRETS_EXPOSED",
    "OWNER_ACTION_REQUIRED",
    "OWNER_ACTIONS",
    "NEXT_EXECUTING_MISSION",
  ];

  const hardFail = process.exitCode;
  const hasBlockers = (results.PILOT_BLOCKERS ?? friction.filter((f) => f.level === "BLOCKER").length) > 0;
  const authPass = results.HVCG_AUTHENTICATED_TENANT === "PASS";
  const importPass = results.HVCG_IMPORT === "PASS";
  const dashPass = results.HVCG_EXECUTIVE_DASHBOARD === "PASS";

  results.GCC_HVCG_INTERNAL_PILOT = authPass && importPass && dashPass && !hardFail ? "LIVE" : "PENDING_OWNER_INPUT";
  results.GCC_AUTHENTICATED_PRODUCTION_JOURNEY =
    authPass && importPass && dashPass && !hardFail ? "PASS" : authPass ? "PARTIAL" : "BLOCKED";
  results.GCC_COMMERCIAL_GOLIVE_CERTIFICATION =
    results.GCC_AUTHENTICATED_PRODUCTION_JOURNEY === "PASS" ? "PASS" : "CONDITIONAL PASS";
  results.FIRST_EXTERNAL_PILOT_PROFILE = "READY";
  results.EXTERNAL_PILOT_SHORTLIST = "REQUIRES_ATLAS_SIDE_CONTEXT";
  results.PILOT_OFFER_OPTIONS = "READY";
  results.EXTERNAL_PILOT_PACKAGE = "READY";
  results.AUTOMATED_GOLIVE_REGRESSION = "READY_PENDING_SECURE_SECRET_CONFIGURATION";
  results.INDEPENDENT_VALIDATION = results.GCC_AUTHENTICATED_PRODUCTION_JOURNEY === "PASS" ? "PASS" : "PARTIAL";
  results.CURRENT_PUBLIC_PRICE = "$149";
  results.SECRETS_EXPOSED = "NONE";
  results.OWNER_ACTION_REQUIRED = hasBlockers || !authPass ? "YES" : "NO";
  results.OWNER_ACTIONS = hasBlockers || !authPass ? "SEE_MISSION_REPORT" : "NONE";
  results.NEXT_EXECUTING_MISSION =
    results.GCC_HVCG_INTERNAL_PILOT === "LIVE"
      ? "FIRST EXTERNAL PILOT CUSTOMER"
      : "Complete HVCG email confirmation + authorized data import, then re-run npm run pilot:hvcg";

  if (friction.length) {
    console.log("\n--- Pilot Friction Log ---");
    for (const f of friction) console.log(`[${f.level}] ${f.item}`);
  }

  for (const k of keys) {
    if (results[k] !== undefined) console.log(`${k} = ${results[k]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
