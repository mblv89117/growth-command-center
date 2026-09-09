#!/usr/bin/env node
/**
 * Structural validation of Supabase → Azure PG migration artifacts.
 * Runs without database passwords or live connections.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const REQUIRED_TABLES = [
  "gcc_organizations",
  "gcc_profiles",
  "gcc_financial_snapshots",
  "gcc_monthly_trends",
  "gcc_kpis",
  "gcc_integration_connections",
  "gcc_connector_audit",
  "gcc_data_provenance",
  "gcc_bank_accounts",
  "gcc_import_jobs",
  "gcc_job_runs",
  "gcc_forecast_versions",
  "gcc_ai_conversations",
  "gcc_ai_messages",
  "gcc_subscriptions",
  "gcc_team_invites",
  "gcc_identity_links",
];

const SCHEMA_FILES = [
  "supabase/setup.sql",
  "supabase/migration-v2.sql",
  "supabase/migration-commercial.sql",
  "supabase/migration-connectors.sql",
  "scripts/azure/gcc-team-invites.sql",
  "scripts/azure/gcc-identity-links-entra.sql",
];

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function assertTablesPresent(sqlBlob, label) {
  const missing = REQUIRED_TABLES.filter(
    (table) => !new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, "i").test(sqlBlob)
  );
  if (missing.length > 0) {
    console.error(`FAIL: ${label} missing CREATE TABLE for: ${missing.join(", ")}`);
    process.exit(1);
  }
}

function assertRlsMention(sqlBlob, label) {
  if (!/ENABLE ROW LEVEL SECURITY/i.test(sqlBlob)) {
    console.warn(`WARN: ${label} has no ENABLE ROW LEVEL SECURITY statements`);
  }
}

function main() {
  let combined = "";
  for (const file of SCHEMA_FILES) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) {
      console.error(`FAIL: missing schema file ${file}`);
      process.exit(1);
    }
    const content = read(file);
    combined += `\n-- ${file}\n${content}`;
    assertRlsMention(content, file);
  }

  // Core supabase files must define tenant tables; azure snippets add entra extras.
  const coreSql = SCHEMA_FILES.slice(0, 4).map(read).join("\n");
  assertTablesPresent(
    coreSql + read("scripts/azure/gcc-team-invites.sql") + read("scripts/azure/gcc-identity-links-entra.sql"),
    "combined schema"
  );

  const migrateScript = read("scripts/migrate-supabase-to-azure-pg.mjs");
  for (const token of ["pg_dump", "psql", "AZURE_DATABASE_URL", "SUPABASE_DATABASE_URL", "--dry-run"]) {
    if (!migrateScript.includes(token)) {
      console.error(`FAIL: migrate script missing token ${token}`);
      process.exit(1);
    }
  }

  if (!fs.existsSync(path.join(repoRoot, "archive/vercel/vercel.json"))) {
    console.error("FAIL: expected archived vercel.json at archive/vercel/vercel.json");
    process.exit(1);
  }

  if (fs.existsSync(path.join(repoRoot, "vercel.json"))) {
    console.error("FAIL: root vercel.json should remain archived");
    process.exit(1);
  }

  console.log("STRUCTURE_VALIDATION: PASS");
  console.log(`Tables checked: ${REQUIRED_TABLES.length}`);
  console.log(`Schema files: ${SCHEMA_FILES.length}`);
  console.log(`Combined SQL size: ${combined.length} bytes`);
}

main();
