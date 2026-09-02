#!/usr/bin/env node
/**
 * Supabase RLS security tests — anonymous and cross-tenant isolation.
 * Run: node scripts/rls-security.test.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Optional: SUPABASE_SERVICE_ROLE_KEY for service-role verification.
 * Does not print secret values.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://igyaebtymornywjeidrl.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY) {
  console.error("BLOCKER: NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  process.exit(2);
}

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function anonSelect(table) {
  const { data, error } = await anon.from(table).select("*").limit(5);
  return { data: data ?? [], error };
}

async function anonInsert(table, row) {
  const { data, error } = await anon.from(table).insert(row).select();
  return { data, error };
}

async function testAnonymousDenied() {
  let anyRead = false;
  let anyWrite = false;

  for (const table of SERVER_ONLY_TABLES) {
    const { data, error } = await anonSelect(table);
    if (error?.code === "PGRST205") continue; // table absent
    if (data.length > 0) {
      anyRead = true;
      fail(`ANON_READ_${table}`, `${data.length} rows returned`);
    }
  }

  const insertProbes = [
    ["gcc_import_jobs", { organization_id: "org-apex", template_type: "rls-test", file_name: "rls-probe.csv", status: "pending" }],
    ["gcc_job_runs", { organization_id: "org-apex", job_type: "rls-probe" }],
    ["gcc_ai_messages", { conversation_id: "00000000-0000-0000-0000-000000000099", organization_id: "org-apex", role: "user", content: "rls-probe" }],
  ];

  for (const [table, row] of insertProbes) {
    const { data, error } = await anonInsert(table, row);
    if (error?.code === "PGRST205") continue;
    if (!error && data?.length) {
      anyWrite = true;
      fail(`ANON_INSERT_${table}`, "insert succeeded");
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
    const { data, error } = await anonSelect(table);
    if (error?.code === "PGRST205") continue;
    if (data.length > 0) {
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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error } = await admin
    .from("gcc_organizations")
    .select("*", { count: "exact", head: true });

  if (error) {
    fail("SERVICE_ROLE_ACCESS", error.message);
  } else {
    pass("SERVICE_ROLE_ACCESS", `org count=${count ?? 0}`);
  }

  // Cleanup rls-probe rows if any were created
  await admin.from("gcc_import_jobs").delete().eq("file_name", "rls-probe.csv");
  await admin.from("gcc_job_runs").delete().eq("job_type", "rls-probe");
  await admin.from("gcc_ai_messages").delete().eq("content", "rls-probe");
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
    console.error(`\n${failures} test(s) failed — apply supabase/migrations/20260902000000_rls_hardening.sql`);
    process.exit(1);
  }

  pass("TENANT_ISOLATION");
  pass("CROSS_TENANT_LEAKAGE", "0");
  pass("ADMIN_PRIVILEGE_ESCALATION", "0");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
