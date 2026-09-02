/**
 * PostgreSQL connection pool for Azure Database for PostgreSQL Flexible Server.
 * Used when AUTH_PROVIDER=entra and DATABASE_URL points to Azure PG (Stage 3).
 */
import pg from "pg";

let pool: pg.Pool | null = null;

export function getPgPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
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
  if (!p) throw new Error("DATABASE_URL is not configured");
  return p.query<T>(text, params);
}
