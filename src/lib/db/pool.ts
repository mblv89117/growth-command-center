/**
 * PostgreSQL connection pool for Azure Database for PostgreSQL Flexible Server.
 * Prefer AZURE_DATABASE_URL (cutover SoT); fall back to DATABASE_URL.
 */
import pg from "pg";

let pool: pg.Pool | null = null;

/**
 * Prefer the Azure Flexible Server URL so dual-env containers can keep a
 * legacy DATABASE_URL without accidentally routing traffic to Supabase PG.
 */
export function getDatabaseUrl(): string | undefined {
  const azure = process.env.AZURE_DATABASE_URL?.trim();
  if (azure) return azure;
  const generic = process.env.DATABASE_URL?.trim();
  return generic || undefined;
}

export function getPgPool(): pg.Pool | null {
  const url = getDatabaseUrl();
  if (!url) return null;

  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: true },
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function pgQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPgPool();
  if (!p) throw new Error("AZURE_DATABASE_URL / DATABASE_URL is not configured");
  return p.query<T>(text, params);
}

export function isAzurePostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

/** Reset singleton — test helper only. */
export function __resetPgPoolForTests(): void {
  pool = null;
}
