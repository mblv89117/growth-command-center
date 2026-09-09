#!/usr/bin/env node
/**
 * Post-cutover delta: copy Supabase rows that are missing on Azure only.
 * Azure is the production data plane — do not overwrite existing Azure rows.
 * Never prints passwords, tokens, or connection strings.
 */
import { execFileSync } from "child_process";
import pg from "pg";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = "azpg3uejm.postgres.database.azure.com";
const DB = "gcc";
const USER = "manny@highvaluecapitalgroup.com";
const VAULT = "kv-atlas-hvcg-ebc84d85";

const COPY_TABLES = [
  "gcc_organizations",
  "gcc_profiles",
  "gcc_financial_snapshots",
  "gcc_monthly_trends",
  "gcc_budget_vs_actual",
  "gcc_kpis",
  "gcc_alerts",
  "gcc_integration_connections",
  "gcc_api_rate_limits",
  "gcc_onboarding_messages",
  "gcc_cash_forecast_weeks",
  "gcc_cash_forecast_months",
  "gcc_scenarios",
  "gcc_forecast_assumptions",
  "gcc_opportunities",
  "gcc_jobs",
  "gcc_invoices",
  "gcc_bills",
  "gcc_transactions",
  "gcc_expense_categories",
  "gcc_revenue_sources",
  "gcc_aging_buckets",
  "gcc_subscriptions",
  "gcc_bank_accounts",
  "gcc_import_jobs",
  "gcc_job_runs",
  "gcc_forecast_versions",
  "gcc_ai_conversations",
  "gcc_ai_messages",
  "gcc_connector_sync_jobs",
  "gcc_data_provenance",
  "gcc_connector_audit",
  "gcc_pdf_import_jobs",
];

function kvSecret(name) {
  return execFileSync(
    "az",
    ["keyvault", "secret", "show", "--vault-name", VAULT, "-n", name, "--query", "value", "-o", "tsv"],
    { encoding: "utf8" }
  );
}

function parseEnv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^[ '"]|[ '"]$/g, "");
  }
  return env;
}

function entraToken() {
  return execFileSync(
    "az",
    ["account", "get-access-token", "--resource", "https://ossrdbms-aad.database.windows.net", "--query", "accessToken", "-o", "tsv"],
    { encoding: "utf8" }
  ).trim();
}

async function withAzure(fn) {
  let last;
  for (let i = 0; i < 6; i++) {
    const client = new pg.Client({
      host: HOST,
      port: 5432,
      database: DB,
      user: USER,
      password: entraToken(),
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 25000,
    });
    try {
      await client.connect();
      const result = await fn(client);
      await client.end();
      return result;
    } catch (err) {
      last = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      const msg = err.message.split("\n")[0];
      const transient = /timeout|ECONNRESET|EAI_AGAIN|Connection terminated/i.test(msg);
      if (!transient) throw err;
      console.log(`AZURE_CONNECT_RETRY ${i + 1} ${msg}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw last;
}

async function restPage(baseUrl, serviceRole, table, offset = 0) {
  const url = `${baseUrl}/rest/v1/${table}?select=*&limit=1000&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      Prefer: "count=exact",
    },
  });
  if (res.status === 404) return { missing: true, rows: [], total: 0 };
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`REST ${table} ${res.status}: ${t.slice(0, 180)}`);
  }
  const rows = await res.json();
  const cr = res.headers.get("content-range") || "";
  const total = Number(cr.split("/")[1] || rows.length);
  return { missing: false, rows, total };
}

async function restAll(baseUrl, serviceRole, table) {
  const first = await restPage(baseUrl, serviceRole, table, 0);
  if (first.missing) return first;
  let rows = first.rows;
  while (rows.length < first.total) {
    const next = await restPage(baseUrl, serviceRole, table, rows.length);
    rows = rows.concat(next.rows);
    if (next.rows.length === 0) break;
  }
  return { missing: false, rows, total: first.total };
}

async function authUsers(baseUrl, serviceRole) {
  const users = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${baseUrl}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
    });
    if (!res.ok) throw new Error(`AUTH_ADMIN ${res.status}`);
    const body = await res.json();
    const batch = body.users || body || [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
}

function qIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`bad ident ${name}`);
  return name;
}

function coercePg(value, udt) {
  if (value === null || value === undefined) return null;
  const jsonType = udt === "json" || udt === "jsonb";
  if (jsonType) {
    if (value === "") return null;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }
  if (typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function main() {
  const gccEnv = parseEnv(kvSecret("Preserve-GCC-EnvLocal"));
  const baseUrl = (gccEnv.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRole = gccEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRole) {
    console.error("BLOCKER: GCC Key Vault env missing Supabase URL or service role");
    process.exit(2);
  }
  console.log(`SOURCE_HOST=${new URL(baseUrl).host}`);
  console.log(`TARGET_HOST=${HOST} TARGET_DB=${DB} MODE=missing-rows-only`);

  const users = await authUsers(baseUrl, serviceRole);
  console.log(`SOURCE_AUTH_USERS=${users.length}`);

  const summary = { authInserted: 0, tables: {} };

  await withAzure(async (client) => {
    for (const u of users) {
      const res = await client.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [
          u.id,
          u.email || null,
          JSON.stringify(u.user_metadata || u.raw_user_meta_data || {}),
          u.created_at || new Date().toISOString(),
          u.updated_at || u.created_at || new Date().toISOString(),
        ]
      );
      summary.authInserted += res.rowCount || 0;
    }
    console.log(`AUTH_USERS_DELTA inserted=${summary.authInserted} source=${users.length}`);

    for (const table of COPY_TABLES) {
      const fetched = await restAll(baseUrl, serviceRole, table);
      if (fetched.missing) {
        console.log(`SOURCE_ABSENT ${table}`);
        summary.tables[table] = { source: 0, missing: true };
        continue;
      }
      const colsRes = await client.query(
        `SELECT column_name, udt_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
         ORDER BY ordinal_position`,
        [table]
      );
      if (!colsRes.rows.length) {
        console.log(`AZURE_ABSENT ${table}`);
        summary.tables[table] = { source: fetched.total, azureAbsent: true };
        continue;
      }
      const cols = colsRes.rows.map((r) => r.column_name);
      const types = Object.fromEntries(colsRes.rows.map((r) => [r.column_name, r.udt_name]));
      const pkRes = await client.query(
        `SELECT a.attname
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
         JOIN pg_class c ON c.oid = i.indrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname='public' AND c.relname=$1 AND i.indisprimary
         ORDER BY a.attnum`,
        [table]
      );
      const pk = pkRes.rows.map((r) => r.attname);
      let inserted = 0;
      for (const row of fetched.rows) {
        const values = cols.map((c) => coercePg(row[c] === undefined ? null : row[c], types[c]));
        const placeholders = cols
          .map((c, i) =>
            types[c] === "json" || types[c] === "jsonb" ? `$${i + 1}::${types[c]}` : `$${i + 1}`
          )
          .join(",");
        const conflict = pk.length ? `(${pk.map(qIdent).join(",")})` : "";
        const sql = pk.length
          ? `INSERT INTO ${qIdent(table)} (${cols.map(qIdent).join(",")}) VALUES (${placeholders})
             ON CONFLICT ${conflict} DO NOTHING`
          : `INSERT INTO ${qIdent(table)} (${cols.map(qIdent).join(",")}) VALUES (${placeholders})
             ON CONFLICT DO NOTHING`;
        const res = await client.query(sql, values);
        inserted += res.rowCount || 0;
      }
      const live = await client.query(`SELECT count(*)::int AS c FROM ${qIdent(table)}`);
      summary.tables[table] = {
        source: fetched.total,
        inserted,
        azure: live.rows[0].c,
      };
      console.log(
        `DELTA ${table} source=${fetched.total} inserted=${inserted} azure=${live.rows[0].c}`
      );
    }

    await client.query(`
      INSERT INTO gcc_identity_links (email, supabase_user_id, gcc_user_id, organization_id, role, linked_at)
      SELECT COALESCE(p.email, u.email, p.id::text),
             u.id, p.id, p.organization_id, p.role, now()
      FROM gcc_profiles p
      JOIN auth.users u ON u.id = p.id
      WHERE COALESCE(p.email, u.email) IS NOT NULL
      ON CONFLICT (email) DO NOTHING
    `);
  });

  const insertedTables = Object.values(summary.tables).filter((t) => t.inserted > 0).length;
  console.log(
    `DELTA_SYNC=PASS authInserted=${summary.authInserted} tablesWithInserts=${insertedTables}`
  );
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
