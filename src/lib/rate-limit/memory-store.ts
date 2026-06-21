import type { RateLimitResult, RateLimitStore } from "./types";

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/** Per-instance store for local dev; swap for Supabase/KV in production. */
export class MemoryRateLimitStore implements RateLimitStore {
  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        resetAt: new Date(now + windowMs),
      };
    }

    if (existing.count >= limit) {
      const resetAt = new Date(existing.windowStart + windowMs);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
      };
    }

    existing.count += 1;
    buckets.set(key, existing);

    return {
      allowed: true,
      remaining: Math.max(limit - existing.count, 0),
      resetAt: new Date(existing.windowStart + windowMs),
    };
  }
}

export const memoryRateLimitStore = new MemoryRateLimitStore();
