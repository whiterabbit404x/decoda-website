/**
 * Lightweight, dependency-free, in-memory rate limiter.
 *
 * This is a best-effort control: the counters live in the process memory of a
 * single instance, so they reset on redeploy and are not shared across
 * horizontally-scaled instances or separate serverless invocations. That is an
 * acceptable, low-cost layer of spam protection on top of the honeypot and
 * server-side validation — it deliberately avoids pulling in an external store
 * (Redis, etc.) that the project does not already use.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Rolling window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (0 when allowed). */
  retryAfterSeconds: number;
}

/** Remove expired buckets so the map cannot grow without bound. */
function prune(now: number): void {
  if (buckets.size < 5000) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

/**
 * Register a hit for `key` and report whether it is allowed. Time is injectable
 * for deterministic tests.
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  prune(now);

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test helper: clear all counters. */
export function __resetRateLimiter(): void {
  buckets.clear();
}
