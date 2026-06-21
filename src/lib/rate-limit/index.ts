import { RateLimitError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { memoryRateLimitStore } from "./memory-store";
import { supabaseRateLimitStore } from "./supabase-store";
import type { RateLimitOptions, RateLimitResult, RateLimitStore } from "./types";

export const AI_ADVISOR_RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 60 * 1000,
} as const;

export const AI_ONBOARD_RATE_LIMIT = AI_ADVISOR_RATE_LIMIT;

function buildRateLimitKey(route: string, userId: string): string {
  return `${route}:${userId}`;
}

function getDefaultStore(): RateLimitStore {
  return createAdminClient() ? supabaseRateLimitStore : memoryRateLimitStore;
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const store = options.store ?? getDefaultStore();
  const key = buildRateLimitKey(options.route, options.userId);

  try {
    return await store.consume(key, options.limit, options.windowMs);
  } catch (error) {
    if (store === memoryRateLimitStore) throw error;
    return memoryRateLimitStore.consume(key, options.limit, options.windowMs);
  }
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const result = await checkRateLimit(options);

  if (!result.allowed) {
    throw new RateLimitError(
      "Rate limit exceeded. Try again later.",
      result.retryAfterSeconds ?? 60
    );
  }

  return result;
}

export type { RateLimitOptions, RateLimitResult, RateLimitStore };
