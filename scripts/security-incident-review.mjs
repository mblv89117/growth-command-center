#!/usr/bin/env node
/**
 * Post-RLS security incident review via PostgREST (no Realtime / WebSocket).
 * Does not print secret values.
 */
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON) {
  console.error("BLOCKER: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required");
  process.exit(2);
}

async function rest(key, method, table, query = "select=*&limit=3") {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data, countHeader: res.headers.get("content-range") };
}

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
    const { status, data } = await rest(ANON, "GET", table);
    if (status === 404) continue;
    if (Array.isArray(data) && data.length > 0) {
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

  const probes = [
    ["gcc_import_jobs", "file_name", ["probe.csv", "rls-probe.csv"]],
    ["gcc_job_runs", "job_type", ["probe", "rls-probe"]],
    ["gcc_forecast_versions", "version_num", ["99999"]],
    ["gcc_ai_messages", "content", ["probe", "rls-probe"]],
  ];

  let remaining = 0;
  for (const [table, column, values] of probes) {
    for (const val of values) {
      const { status, data } = await rest(
        SERVICE,
        "GET",
        table,
        `select=id&${column}=eq.${encodeURIComponent(val)}&limit=5`
      );
      if (status >= 400) continue;
      const count = Array.isArray(data) ? data.length : 0;
      if (count > 0) {
        console.log(`PROBE_REMAINING: ${table}.${column}=${val} count=${count}`);
        remaining += count;
      }
    }
  }
  return remaining === 0;
}

async function main() {
  console.log("SECURITY_INCIDENT_REVIEW");
  console.log(
    "EXPOSURE_SCOPE: Confirmed pre-RLS anonymous read/write on server-only tables (audit probes)"
  );
  console.log(
    "ACTUAL_UNAUTHORIZED_ACCESS_EVIDENCE: INSUFFICIENT_LOG_RETENTION — no Supabase audit log API in agent scope"
  );

  const anonOk = await checkAnonAccess();
  console.log(`ANONYMOUS_ACCESS_AFTER_RLS: ${anonOk ? "DENIED" : "FAIL"}`);

  const probesRemoved = await checkProbeRows();
  if (probesRemoved === true) console.log("AUDIT_PROBE_ROWS_REMOVED: PASS");
  else if (probesRemoved === false) console.log("AUDIT_PROBE_ROWS_REMOVED: FAIL");
  else console.log("AUDIT_PROBE_ROWS_REMOVED: UNKNOWN");

  console.log(`SECURITY_INCIDENT_REVIEW: ${anonOk ? "PASS" : "FAIL"}`);
  process.exit(anonOk ? 0 : 1);
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
