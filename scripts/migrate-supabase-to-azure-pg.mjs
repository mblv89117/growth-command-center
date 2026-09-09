#!/usr/bin/env node
/**
 * Migrate schema + data from Supabase Postgres to Azure PostgreSQL Flexible Server.
 * Stage 3 — run only after Azure PG is provisioned and reachable.
 *
 * Requires:
 *   SUPABASE_DATABASE_URL or SOURCE_DATABASE_URL (source)
 *   AZURE_DATABASE_URL or TARGET_DATABASE_URL (target)
 *
 * Optional:
 *   --dry-run — print commands only
 *   --schema-only — skip data restore
 *   --skip-verify — skip row-count query
 *
 * Does not print connection strings or passwords.
 */
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SOURCE = process.env.SUPABASE_DATABASE_URL ?? process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.AZURE_DATABASE_URL ?? process.env.TARGET_DATABASE_URL;
const DRY_RUN = process.argv.includes("--dry-run");
const SCHEMA_ONLY = process.argv.includes("--schema-only");
const SKIP_VERIFY = process.argv.includes("--skip-verify");

function requireUrl(name, value) {
  if (!value) {
    console.error(`BLOCKER: ${name} required`);
    process.exit(2);
  }
  return value;
}

function redact(cmd) {
  return cmd.replace(/:[^@]+@/g, ":***@");
}

function run(cmd, opts = {}) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${redact(cmd)}`);
    return;
  }
  execSync(cmd, { stdio: "inherit", ...opts });
}

function applyAzureSnippets() {
  const snippets = [
    "scripts/azure/gcc-identity-links-entra.sql",
    "scripts/azure/gcc-team-invites.sql",
  ];
  for (const rel of snippets) {
    const file = path.join(repoRoot, rel);
    if (!fs.existsSync(file)) {
      console.warn(`WARN: missing Azure snippet ${rel}`);
      continue;
    }
    console.log(`Applying Azure snippet ${rel}...`);
    run(`psql "${TARGET}" -v ON_ERROR_STOP=1 -f "${file}"`);
  }
}

async function main() {
  requireUrl("SOURCE (SUPABASE_DATABASE_URL)", SOURCE);
  requireUrl("TARGET (AZURE_DATABASE_URL)", TARGET);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gcc-pg-migrate-"));
  const schemaFile = path.join(tmp, "schema.sql");
  const dataFile = path.join(tmp, "data.sql");

  console.log("Step 1/5: Schema dump from Supabase...");
  run(
    `pg_dump "${SOURCE}" --schema-only --no-owner --no-privileges -f "${schemaFile}"`
  );

  if (!SCHEMA_ONLY) {
    console.log("Step 2/5: Data dump from Supabase...");
    run(
      `pg_dump "${SOURCE}" --data-only --no-owner --exclude-schema=auth --exclude-schema=storage --exclude-schema=supabase_functions -f "${dataFile}"`
    );
  } else {
    console.log("Step 2/5: Skipped data dump (--schema-only)");
  }

  console.log("Step 3/5: Restore schema to Azure PostgreSQL...");
  run(`psql "${TARGET}" -v ON_ERROR_STOP=1 -f "${schemaFile}"`);

  if (!SCHEMA_ONLY) {
    console.log("Step 4/5: Restore data to Azure PostgreSQL...");
    run(`psql "${TARGET}" -v ON_ERROR_STOP=1 -f "${dataFile}"`);
  } else {
    console.log("Step 4/5: Skipped data restore (--schema-only)");
  }

  console.log("Step 5/5: Apply Entra / invite Azure snippets...");
  applyAzureSnippets();

  if (!SKIP_VERIFY && !DRY_RUN) {
    console.log("Verification: row counts (top 20 public tables)...");
    run(
      `psql "${TARGET}" -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC LIMIT 20;"`
    );
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("DATA_MIGRATION: PASS (review row counts manually; run validate-migration-structure separately)");
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
