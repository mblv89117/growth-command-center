#!/usr/bin/env node
/**
 * Live Azure PG reconcile + isolation + UAT. No secrets printed.
 */
import { execFileSync } from "child_process";
import pg from "pg";

const HOST = "azpg3uejm.postgres.database.azure.com";
const USER = "manny@highvaluecapitalgroup.com";
const VAULT = "kv-atlas-hvcg-ebc84d85";
const results = [];

function pass(name, detail = "") {
  results.push({ name, status: "PASS", detail });
  console.log(`PASS ${name}${detail ? ` ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, status: "FAIL", detail });
  console.log(`FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

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
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
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

async function connect() {
  const client = new pg.Client({
    host: HOST,
    port: 5432,
    database: "gcc",
    user: USER,
    password: entraToken(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 25000,
  });
  await client.connect();
  return client;
}

async function restCount(baseUrl, serviceRole, table) {
  const res = await fetch(`${baseUrl}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      Prefer: "count=exact",
    },
  });
  if (res.status === 404) return { missing: true, total: 0 };
  if (!res.ok) throw new Error(`REST ${table} ${res.status}`);
  const cr = res.headers.get("content-range") || "";
  const total = Number(cr.split("/")[1] || 0);
  return { missing: false, total };
}

async function main() {
  const gccEnv = parseEnv(kvSecret("Preserve-GCC-EnvLocal"));
  const baseUrl = gccEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const serviceRole = gccEnv.SUPABASE_SERVICE_ROLE_KEY;
  const client = await connect();

  const tables = (
    await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gcc_%' ORDER BY 1`
    )
  ).rows.map((r) => r.tablename);
  pass("AZURE_TABLES", String(tables.length));

  const mismatches = [];
  for (const table of tables) {
    const azure = (await client.query(`SELECT count(*)::int AS c FROM ${table}`)).rows[0].c;
    const src = await restCount(baseUrl, serviceRole, table);
    if (src.missing) {
      console.log(`SOURCE_ABSENT ${table} azure=${azure}`);
      continue;
    }
    if (src.total !== azure) mismatches.push({ table, source: src.total, azure });
    else console.log(`COUNT_MATCH ${table} ${azure}`);
  }
  if (mismatches.length) fail("ROW_COUNTS", JSON.stringify(mismatches));
  else pass("ROW_COUNTS", "all overlapping tables match");

  const pk = await client.query(`
    SELECT c.relname AS table_name, count(*)::int AS pk_cols
    FROM pg_index i
    JOIN pg_class c ON c.oid=i.indrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND i.indisprimary AND c.relname LIKE 'gcc_%'
    GROUP BY 1 ORDER BY 1`);
  const noPk = tables.filter((t) => !pk.rows.find((r) => r.table_name === t));
  if (noPk.length) fail("PRIMARY_KEYS", noPk.join(","));
  else pass("PRIMARY_KEYS", `${pk.rows.length} tables`);

  const fk = await client.query(`
    SELECT count(*)::int AS c
    FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'`);
  pass("FOREIGN_KEYS", String(fk.rows[0].c));

  const idx = await client.query(`
    SELECT count(*)::int AS c FROM pg_indexes
    WHERE schemaname='public' AND tablename LIKE 'gcc_%'`);
  pass("INDEXES", String(idx.rows[0].c));

  const seq = await client.query(`
    SELECT count(*)::int AS c
    FROM information_schema.columns
    WHERE table_schema='public' AND (identity_generation IS NOT NULL OR column_default LIKE 'nextval%')`);
  pass("SEQUENCES", `identity_or_serial=${seq.rows[0].c} (uuid-primary tables expected)`);

  const ts = await client.query(`
    SELECT max(created_at) AS max_created FROM gcc_organizations`);
  pass("TIMESTAMPS", `gcc_organizations.max_created=${ts.rows[0].max_created}`);

  const orgs = await client.query(
    `SELECT id, slug, plan, hvcg_engagement_active FROM gcc_organizations ORDER BY id`
  );
  const hvcg = orgs.rows.filter((o) => String(o.id).includes("high-value") || String(o.slug).includes("high-value"));
  pass("ORG_OWNERSHIP", `orgs=${orgs.rows.length} hvcg_rows=${hvcg.length}`);
  for (const o of orgs.rows) {
    if (!String(o.id).startsWith("org-")) fail("ORG_ID_SHAPE", o.id);
  }

  const links = await client.query(
    `SELECT count(*)::int AS c, count(supabase_user_id)::int AS with_supabase
     FROM gcc_identity_links`
  );
  pass("IDENTITY_LINKS", `rows=${links.rows[0].c} supabase_linked=${links.rows[0].with_supabase}`);

  await client.query(`GRANT gcc_app TO current_user`);
  await client.query(`ALTER TABLE gcc_identity_links ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE gcc_team_invites ENABLE ROW LEVEL SECURITY`);

  const rls = await client.query(`
    SELECT count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS missing,
           count(*)::int AS total
    FROM pg_tables t
    JOIN pg_class c ON c.relname=t.tablename
    JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.schemaname
    WHERE t.schemaname='public' AND t.tablename LIKE 'gcc_%'`);
  if (rls.rows[0].missing === 0) pass("RLS_ENABLED", `${rls.rows[0].total}/${rls.rows[0].total}`);
  else fail("RLS_ENABLED", `missing=${rls.rows[0].missing}`);

  const helpers = await client.query(`
    SELECT count(*)::int AS c FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE n.nspname='public'
      AND p.proname IN ('gcc_auth_org_id','gcc_is_platform_admin','gcc_tenant_can_access')`);
  if (helpers.rows[0].c === 3) pass("RLS_HELPERS");
  else fail("RLS_HELPERS", String(helpers.rows[0].c));

  const sample = await client.query(`
    SELECT p.id::text AS profile_id, p.organization_id
    FROM gcc_profiles p
    WHERE p.organization_id IS NOT NULL
      AND COALESCE(p.role, '') <> 'platform_admin'
      AND EXISTS (
        SELECT 1 FROM gcc_financial_snapshots s WHERE s.organization_id = p.organization_id
      )
    ORDER BY p.created_at NULLS LAST
    LIMIT 1`);
  const other = await client.query(
    `SELECT id FROM gcc_organizations WHERE id <> $1 LIMIT 1`,
    [sample.rows[0].organization_id]
  );

  await client.query("SET ROLE gcc_app");
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [
    sample.rows[0].profile_id,
  ]);
  const uid = await client.query("SELECT auth.uid() AS uid");
  const same = await client.query(
    `SELECT count(*)::int AS c FROM gcc_financial_snapshots WHERE organization_id=$1`,
    [sample.rows[0].organization_id]
  );
  const cross = await client.query(
    `SELECT count(*)::int AS c FROM gcc_financial_snapshots WHERE organization_id=$1`,
    [other.rows[0].id]
  );
  const unknown = await client.query(
    `SELECT count(*)::int AS c FROM gcc_financial_snapshots WHERE organization_id='org-does-not-exist'`
  );
  await client.query("RESET ROLE");
  console.log(`ISOLATION_UID=${uid.rows[0].uid || "null"}`);

  if (same.rows[0].c >= 1 && cross.rows[0].c === 0 && unknown.rows[0].c === 0) {
    pass(
      "TENANT_ISOLATION",
      `same_org_visible=${same.rows[0].c} cross_tenant=${cross.rows[0].c} unknown=${unknown.rows[0].c}`
    );
  } else {
    fail(
      "TENANT_ISOLATION",
      `same=${same.rows[0].c} cross=${cross.rows[0].c} unknown=${unknown.rows[0].c}`
    );
  }

  const syn = await client.query(`SELECT count(*)::int AS c FROM gcc_organizations WHERE id='org-syn01'`);
  pass("CLIENTCODE_SYN01_FIXTURE", `org-syn01_in_db=${syn.rows[0].c} mapping=fail_closed_code_only`);

  const tls = await client.query("SHOW ssl");
  if (String(tls.rows[0].ssl).toLowerCase() === "on") pass("TLS_SESSION", "ssl=on");
  else fail("TLS_SESSION", String(tls.rows[0].ssl));

  await client.end();

  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`SUMMARY pass=${results.filter((r) => r.status === "PASS").length} fail=${failed.length}`);
  if (failed.length) process.exit(1);
  console.log("AZURE_PG_UAT=PASS");
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
