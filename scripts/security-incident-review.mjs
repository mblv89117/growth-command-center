#!/usr/bin/env node
/**
 * Post-RLS security incident review — checks probe rows and anon access.
 * Does not print secret values.
 */
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON) {
  console.error("BLOCKER: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required");
  process.exit(2);
}

const anon = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PROBE_TABLES = [
  "gcc_import_jobs",
  "gcc_job_runs",
  "gcc_forecast_versions",
  "gcc_ai_messages",
];

const PROBE_FILTERS = {
  gcc_import_jobs: { column: "file_name", values: ["probe.csv", "rls-probe.csv"] },
  gcc_job_runs: { column: "job_type", values: ["probe", "rls-probe"] },
  gcc_forecast_versions: { column: "version_num", values: [99999] },
  gcc_ai_messages: { column: "content", values: ["probe", "rls-probe"] },
};

async function checkAnonAccess() {
  let leaked = false;
  for (const table of [
    "gcc_ai_conversations",
    "gcc_ai_messages",
    "gcc_import_jobs",
    "gcc_job_runs",
    "gcc_forecast_versions",
    "gcc_integration_connections",
  ]) {
    const { data, error } = await anon.from(table).select("*").limit(3);
    if (error?.code === "PGRST205") continue;
    if ((data?.length ?? 0) > 0) {
      console.log(`ANON_LEAK: ${table} returned ${data.length} row(s)`);
      leaked = true;
    }
  }
  return !leaked;
}

async function checkProbeRows() {
  if (!SERVICE) {
    console.log("PROBE_ROWS: SKIP — SUPABASE_SERVICE_ROLE_KEY not set");
    return null;
  }

  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let remaining = 0;
  for (const table of PROBE_TABLES) {
    const filter = PROBE_FILTERS[table];
    for (const val of filter.values) {
      const { count } = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(filter.column, val);
      if (count && count > 0) {
        console.log(`PROBE_REMAINING: ${table}.${filter.column}=${val} count=${count}`);
        remaining += count;
      }
    }
  }
  return remaining === 0;
}

async function main() {
  console.log("SECURITY_INCIDENT_REVIEW");
  console.log("EXPOSURE_SCOPE: Confirmed pre-RLS anonymous read/write on server-only tables (audit probes)");
  console.log("ACTUAL_UNAUTHORIZED_ACCESS_EVIDENCE: INSUFFICIENT_LOG_RETENTION — no Supabase audit log API in agent scope");

  const anonOk = await checkAnonAccess();
  console.log(`ANONYMOUS_ACCESS_AFTER_RLS: ${anonOk ? "DENIED" : "FAIL"}`);

  const probesRemoved = await checkProbeRows();
  if (probesRemoved === true) console.log("AUDIT_PROBE_ROWS_REMOVED: PASS");
  else if (probesRemoved === false) console.log("AUDIT_PROBE_ROWS_REMOVED: FAIL");
  else console.log("AUDIT_PROBE_ROWS_REMOVED: UNKNOWN");

  console.log(`SECURITY_INCIDENT_REVIEW: ${anonOk ? "PASS" : "FAIL"}`);
  process.exit(anonOk ? 0 : 1);
}

main();
