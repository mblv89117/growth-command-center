#!/usr/bin/env node
/**
 * Apply Supabase RLS migration via Management API (no direct DATABASE_URL required).
 * Requires SUPABASE_ACCESS_TOKEN with database_write scope.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/apply-supabase-rls-via-api.mjs
 *   node scripts/apply-supabase-rls-via-api.mjs --dry-run
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "igyaebtymornywjeidrl");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATION = path.join(
  __dirname,
  "../supabase/migrations/20260902000000_rls_hardening.sql"
);

async function runQuery(query, readOnly = false) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: readOnly }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Management API ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}

async function main() {
  if (!fs.existsSync(MIGRATION)) {
    console.error(`FAIL: migration not found: ${MIGRATION}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION, "utf8");

  if (DRY_RUN) {
    console.log(`DRY RUN — would apply ${MIGRATION} (${sql.length} bytes) to ${PROJECT_REF}`);
    process.exit(0);
  }

  if (!TOKEN) {
    console.error(
      "BLOCKER: SUPABASE_ACCESS_TOKEN required.\n" +
        "Create at: https://supabase.com/dashboard/account/tokens (database_write scope)\n" +
        "Add as GitHub secret: SUPABASE_ACCESS_TOKEN\n" +
        "Alternative: SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL for direct Postgres"
    );
    process.exit(2);
  }

  console.log(`Applying RLS migration to project ${PROJECT_REF}...`);
  await runQuery(sql, false);
  console.log("RLS migration: PASS");

  const verifySql = fs.readFileSync(
    path.join(__dirname, "../supabase/verify-rls.sql"),
    "utf8"
  );
  const verify = await runQuery(verifySql, true);
  console.log("verify-rls.sql:");
  for (const row of verify ?? []) {
    console.log(`${row.check}\t${row.result}\t${row.detail ?? ""}`);
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
