import { Redis } from "@upstash/redis";

// TODO: instantiate from env once env.ts is wired
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Sliding-window rate limiter backed by Upstash Redis.
 * @param key     Unique key (e.g. `ratelimit:userId:action`)
 * @param limit   Max requests allowed per window
 * @param windowSeconds  Window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // TODO: implement sliding window using INCR + EXPIRE
  return { success: true, remaining: limit - 1, resetAt: new Date() };
}
