import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstashEnv =
  !!process.env["UPSTASH_REDIS_REST_URL"] && !!process.env["UPSTASH_REDIS_REST_TOKEN"];

const redis = hasUpstashEnv ? Redis.fromEnv() : null;

export const staffLoginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "5 m"),
      prefix: "rl:staff-login",
    })
  : null;

export const staffOperatorsListLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "rl:staff-operators",
    })
  : null;

export const adminLoginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "rl:admin-login",
    })
  : null;

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; reset?: number }> {
  if (!limiter) return { success: true };
  const result = await limiter.limit(identifier);
  return { success: result.success, reset: result.reset };
}
