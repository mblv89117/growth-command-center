import { createAdminClient } from "@/lib/supabase/admin";
import type { RateLimitResult, RateLimitStore } from "./types";

/** Shared store backed by gcc_api_rate_limits (service role only). */
export class SupabaseRateLimitStore implements RateLimitStore {
  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const admin = createAdminClient();
    if (!admin) {
      throw new Error("Supabase admin client unavailable for rate limiting");
    }

    const now = Date.now();
    const { data: existing, error: readError } = await admin
      .from("gcc_api_rate_limits")
      .select("request_count, window_start")
      .eq("bucket_key", key)
      .maybeSingle();

    if (readError) {
      throw new Error(`Rate limit read failed: ${readError.message}`);
    }

    const windowStartMs = existing?.window_start
      ? new Date(existing.window_start as string).getTime()
      : null;
    const windowExpired =
      !existing || windowStartMs === null || now - windowStartMs >= windowMs;

    if (windowExpired) {
      const windowStart = new Date(now).toISOString();
      const { error: upsertError } = await admin.from("gcc_api_rate_limits").upsert(
        {
          bucket_key: key,
          request_count: 1,
          window_start: windowStart,
        },
        { onConflict: "bucket_key" }
      );

      if (upsertError) {
        throw new Error(`Rate limit reset failed: ${upsertError.message}`);
      }

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

    const { error: updateError } = await admin
      .from("gcc_api_rate_limits")
      .update({ request_count: currentCount + 1 })
      .eq("bucket_key", key);

    if (updateError) {
      throw new Error(`Rate limit update failed: ${updateError.message}`);
    }

    return {
      allowed: true,
      remaining: Math.max(limit - currentCount - 1, 0),
      resetAt: new Date(windowStartMs! + windowMs),
    };
  }
}

export const supabaseRateLimitStore = new SupabaseRateLimitStore();
