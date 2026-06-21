export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

export interface RateLimitOptions {
  route: string;
  userId: string;
  limit: number;
  windowMs: number;
  store?: RateLimitStore;
}
