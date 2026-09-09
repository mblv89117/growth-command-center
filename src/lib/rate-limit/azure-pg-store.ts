import { pgQuery } from "@/lib/db/pool";
import { isAzureDataPlaneActive } from "@/lib/data/data-plane";
import type { RateLimitResult, RateLimitStore } from "./types";

/** Shared store backed by gcc_api_rate_limits (Azure PG when URL set). */
export class AzurePgRateLimitStore implements RateLimitStore {
  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    if (!isAzureDataPlaneActive()) {
      throw new Error("Azure PG is not configured for rate limiting");
    }

    const now = Date.now();
    const { rows } = await pgQuery<{ request_count: number; window_start: string }>(
      "SELECT request_count, window_start FROM gcc_api_rate_limits WHERE bucket_key = $1 LIMIT 1",
      [key]
    );
    const existing = rows[0];

    const windowStartMs = existing?.window_start
      ? new Date(existing.window_start).getTime()
      : null;
    const windowExpired =
      !existing || windowStartMs === null || now - windowStartMs >= windowMs;

    if (windowExpired) {
      const windowStart = new Date(now).toISOString();
      await pgQuery(
        `INSERT INTO gcc_api_rate_limits (bucket_key, request_count, window_start)
         VALUES ($1, 1, $2)
         ON CONFLICT (bucket_key) DO UPDATE SET request_count = 1, window_start = EXCLUDED.window_start`,
        [key, windowStart]
      );

      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        resetAt: new Date(now + windowMs),
      };
    }

    const currentCount = Number(existing.request_count);
    if (currentCount >= limit) {
      const resetAt = new Date(windowStartMs! + windowMs);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
      };
    }

    await pgQuery(
      "UPDATE gcc_api_rate_limits SET request_count = $2 WHERE bucket_key = $1",
      [key, currentCount + 1]
    );

    return {
      allowed: true,
      remaining: Math.max(limit - currentCount - 1, 0),
      resetAt: new Date(windowStartMs! + windowMs),
    };
  }
}

export const azurePgRateLimitStore = new AzurePgRateLimitStore();
