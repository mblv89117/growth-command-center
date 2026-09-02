#!/usr/bin/env node
/**
 * Migrate schema + data from Supabase Postgres to Azure PostgreSQL Flexible Server.
 * Stage 3 — run only after Azure PG is provisioned and reachable.
 *
 * Requires:
 *   SUPABASE_DATABASE_URL or DATABASE_URL (source)
 *   AZURE_DATABASE_URL (target)
 *
 * Does not print connection strings or passwords.
 */
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const SOURCE = process.env.SUPABASE_DATABASE_URL ?? process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.AZURE_DATABASE_URL ?? process.env.TARGET_DATABASE_URL;
const DRY_RUN = process.argv.includes("--dry-run");

function requireUrl(name, value) {
  if (!value) {
    console.error(`BLOCKER: ${name} required`);
    process.exit(2);
  }
  return value;
}

function run(cmd, opts = {}) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${cmd.replace(/:[^@]+@/g, ":***@")}`);
    return;
  }
  execSync(cmd, { stdio: "inherit", ...opts });
}

async function main() {
  requireUrl("SOURCE (SUPABASE_DATABASE_URL)", SOURCE);
  requireUrl("TARGET (AZURE_DATABASE_URL)", TARGET);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-pg-migrate-"));
  const schemaFile = path.join(tmp, "schema.sql");
  const dataFile = path.join(tmp, "data.sql");

  console.log("Step 1/4: Schema dump from Supabase...");
  run(`pg_dump "${SOURCE}" --schema-only --no-owner --no-privileges -f "${schemaFile}"`);

  console.log("Step 2/4: Data dump from Supabase...");
  run(
    `pg_dump "${SOURCE}" --data-only --no-owner --exclude-schema=auth --exclude-schema=storage --exclude-schema=supabase_functions -f "${dataFile}"`
  );

  console.log("Step 3/4: Restore schema to Azure PostgreSQL...");
  run(`psql "${TARGET}" -v ON_ERROR_STOP=1 -f "${schemaFile}"`);

  console.log("Step 4/4: Restore data to Azure PostgreSQL...");
  run(`psql "${TARGET}" -v ON_ERROR_STOP=1 -f "${dataFile}"`);

  console.log("Step 5: Row-count verification...");
  if (!DRY_RUN) {
    run(
      `psql "${TARGET}" -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC LIMIT 20;"`
    );
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("DATA_MIGRATION: PASS (review row counts manually)");
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
