import { env } from "@/lib/env";
import { Redis } from "@upstash/redis";

// TODO: instantiate from env once env.ts is wired
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
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
  const client = getRedis();

  // Increment the counter for this key
  const currentCount = await client.incr(key);

  // If this is the first request, set the expiration window
  if (currentCount === 1) {
    await client.expire(key, windowSeconds);
  }

  // Calculate remaining requests
  const remaining = Math.max(0, limit - currentCount);

  // Calculate when this window will reset
  const resetAt = new Date(Date.now() + windowSeconds * 1000);

  return {
    success: currentCount <= limit,
    remaining,
    resetAt,
  };
}
