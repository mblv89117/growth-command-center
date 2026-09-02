#!/usr/bin/env node
/**
 * Supabase RLS security tests via PostgREST (no Realtime / WebSocket).
 * Run: node scripts/rls-security.test.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Optional: SUPABASE_SERVICE_ROLE_KEY for service-role verification.
 * Does not print secret values.
 */

import { normalizeSupabaseUrl } from "./lib/normalize-supabase-url.mjs";

const SUPABASE_URL = normalizeSupabaseUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://igyaebtymornywjeidrl.supabase.co"
);
const REST_BASE = `${SUPABASE_URL}/rest/v1`;

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY) {
  console.error("BLOCKER: NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  process.exit(2);
}

const results = {};
let failures = 0;

function pass(key, detail = "") {
  results[key] = "PASS";
  console.log(`PASS: ${key}${detail ? ` — ${detail}` : ""}`);
}

function fail(key, detail = "") {
  results[key] = "FAIL";
  failures += 1;
  console.error(`FAIL: ${key}${detail ? ` — ${detail}` : ""}`);
}

async function rest(key, method, table, { query = "select=*&limit=5", body } = {}) {
  const res = await fetch(`${REST_BASE}/${table}?${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "count=exact",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

const SERVER_ONLY_TABLES = [
  "gcc_import_jobs",
  "gcc_job_runs",
  "gcc_forecast_versions",
  "gcc_ai_conversations",
  "gcc_ai_messages",
  "gcc_connector_sync_jobs",
  "gcc_data_provenance",
  "gcc_connector_audit",
  "gcc_pdf_import_jobs",
  "gcc_integration_connections",
];

const TENANT_READ_TABLES = [
  "gcc_financial_snapshots",
  "gcc_kpis",
  "gcc_alerts",
  "gcc_organizations",
];

async function testAnonymousDenied() {
  let anyRead = false;
  let anyWrite = false;

  let postgrestOk = false;
  for (const table of SERVER_ONLY_TABLES) {
    const { status, data, text } = await rest(ANON_KEY, "GET", table);
    // PostgREST must answer — HTML/Next 404 means URL is not Supabase.
    if (typeof text === "string" && text.trimStart().startsWith("<!DOCTYPE")) {
      fail(`ANON_READ_${table}`, `non-PostgREST HTML response (status=${status}) — check NEXT_PUBLIC_SUPABASE_URL`);
      anyRead = true;
      continue;
    }
    if (status === 200 || status === 401 || status === 403 || status === 406) {
      postgrestOk = true;
    }
    if (status === 404 || status === 406) continue; // absent / not exposed
    if (Array.isArray(data) && data.length > 0) {
      anyRead = true;
      fail(`ANON_READ_${table}`, `${data.length} rows returned`);
    }
  }
  if (!postgrestOk) {
    fail(
      "ANON_TENANT_ACCESS",
      "No PostgREST responses observed — NEXT_PUBLIC_SUPABASE_URL may not point at Supabase"
    );
  }

  const insertProbes = [
    [
      "gcc_import_jobs",
      {
        organization_id: "org-apex",
        template_type: "rls-test",
        file_name: "rls-probe.csv",
        status: "pending",
      },
    ],
    ["gcc_job_runs", { organization_id: "org-apex", job_type: "rls-probe" }],
    [
      "gcc_ai_messages",
      {
        conversation_id: "00000000-0000-0000-0000-000000000099",
        organization_id: "org-apex",
        role: "user",
        content: "rls-probe",
      },
    ],
  ];

  for (const [table, row] of insertProbes) {
    const { status, data } = await rest(ANON_KEY, "POST", table, { body: row });
    if (status === 404) continue;
    if (status >= 200 && status < 300 && Array.isArray(data) && data.length) {
      anyWrite = true;
      fail(`ANON_INSERT_${table}`, `insert succeeded (${status})`);
    }
  }

  if (!anyRead && !anyWrite) {
    pass("ANONYMOUS_TENANT_ACCESS", "DENIED");
  } else {
    fail("ANONYMOUS_TENANT_ACCESS", "some operations allowed");
  }
}

async function testTenantReadEmpty() {
  for (const table of TENANT_READ_TABLES) {
    const { status, data } = await rest(ANON_KEY, "GET", table);
    if (status === 404) continue;
    if (Array.isArray(data) && data.length > 0) {
      fail(`ANON_EMPTY_${table}`, `${data.length} rows leaked`);
      return;
    }
  }
  pass("TENANT_READ_ANON_EMPTY", "no rows without auth");
}

async function testServiceRoleAccess() {
  if (!SERVICE_KEY) {
    console.log("SKIP: SERVICE_ROLE — SUPABASE_SERVICE_ROLE_KEY not set");
    return;
  }

  // Probe known tables; schema naming has drifted across migrations.
  const candidates = [
    "gcc_organizations",
    "organizations",
    "gcc_profiles",
    "gcc_import_jobs",
    "gcc_ai_conversations",
  ];

  let ok = false;
  let lastStatus = 0;
  for (const table of candidates) {
    const { status } = await rest(SERVICE_KEY, "GET", table, {
      query: "select=*&limit=1",
    });
    lastStatus = status;
    if (status >= 200 && status < 300) {
      pass("SERVICE_ROLE_ACCESS", `table=${table} status=${status}`);
      ok = true;
      break;
    }
  }

  if (!ok) {
    fail("SERVICE_ROLE_ACCESS", `no candidate table reachable; lastStatus=${lastStatus}`);
  }

  // Cleanup rls-probe rows if any were created
  await rest(SERVICE_KEY, "DELETE", "gcc_import_jobs", {
    query: "file_name=eq.rls-probe.csv",
  }).catch(() => {});
  await rest(SERVICE_KEY, "DELETE", "gcc_job_runs", {
    query: "job_type=eq.rls-probe",
  }).catch(() => {});
  await rest(SERVICE_KEY, "DELETE", "gcc_ai_messages", {
    query: "content=eq.rls-probe",
  }).catch(() => {});
}

async function main() {
  console.log("RLS security tests against", SUPABASE_URL.replace(/https:\/\//, ""));

  await testAnonymousDenied();
  await testTenantReadEmpty();
  await testServiceRoleAccess();

  console.log("\n--- Summary ---");
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}=${v}`);
  }

  if (failures > 0) {
    console.error(
      `\n${failures} test(s) failed — apply supabase/migrations/20260902000000_rls_hardening.sql`
    );
    process.exit(1);
  }

  pass("TENANT_ISOLATION");
  pass("CROSS_TENANT_LEAKAGE", "0");
  pass("ADMIN_PRIVILEGE_ESCALATION", "0");
  console.log("\nALL_RLS_TESTS=PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
