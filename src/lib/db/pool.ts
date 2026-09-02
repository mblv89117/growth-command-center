/**
 * PostgreSQL connection pool for Azure Database for PostgreSQL Flexible Server.
 * Active when DATABASE_URL (or AZURE_DATABASE_URL) is set.
 */
import pg from "pg";

let pool: pg.Pool | null = null;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.AZURE_DATABASE_URL;
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
  if (!p) throw new Error("DATABASE_URL / AZURE_DATABASE_URL is not configured");
  return p.query<T>(text, params);
}

export function isAzurePostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}
