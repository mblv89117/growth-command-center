#!/usr/bin/env node
/**
 * Run Supabase SQL files against the project database.
 * Requires DATABASE_URL or SUPABASE_DB_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL).
 * Does not print secrets.
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!password || !supabaseUrl) return null;

  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) return null;

  const ref = match[1];
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
}

async function runFile(client, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  await client.query(sql);
}

async function runVerify(client, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  const result = await client.query(sql);
  return result;
}

async function main() {
  const mode = process.argv[2] ?? "all";
  const dbUrl = getDatabaseUrl();

  if (!dbUrl) {
    console.error(
      "BLOCKER: Missing DATABASE_URL or SUPABASE_DB_PASSWORD for direct Postgres access."
    );
    console.error(
      "Grant access with one of:\n" +
        "  export DATABASE_URL='postgresql://postgres:...@db.<project-ref>.supabase.co:5432/postgres'\n" +
        "  export SUPABASE_DB_PASSWORD='<database password from Supabase Dashboard → Database settings>'\n" +
        "Or authenticate Supabase CLI:\n" +
        "  npx supabase login\n" +
        "  npx supabase link --project-ref <ref> --password '<database password>'\n" +
        "  npx supabase db query -f supabase/setup.sql --linked"
    );
    process.exit(2);
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    if (mode === "setup" || mode === "all") {
      await runFile(client, path.join(root, "supabase/setup.sql"));
      console.log("setup.sql: PASS");
    }

    if (mode === "verify" || mode === "all") {
      const verifyPath = path.join(root, "supabase/verify-setup.sql");
      const result = await runVerify(client, verifyPath);
      console.log("verify-setup.sql:");
      for (const row of result.rows ?? []) {
        console.log(`${row.check}\t${row.result}\t${row.detail ?? ""}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
