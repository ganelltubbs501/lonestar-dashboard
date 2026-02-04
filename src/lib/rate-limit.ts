/**
 * Simple in-memory rate limiter
 *
 * For single-instance deployments, this provides effective rate limiting.
 * For multi-instance deployments, consider using @upstash/ratelimit with Redis.
 *
 * Usage:
 *   const limiter = createRateLimiter({ interval: 60000, limit: 10 });
 *   const { success, remaining } = limiter.check(identifier);
 */

interface RateLimitConfig {
  /** Time window in milliseconds */
  interval: number;
  /** Maximum requests per interval */
  limit: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(config: RateLimitConfig) {
  const { interval, limit } = config;
  const storeKey = `${interval}-${limit}`;

  // Get or create store for this config
  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }
  const store = stores.get(storeKey)!;

  // Cleanup old entries periodically
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  };

  // Run cleanup every minute
  if (typeof setInterval !== 'undefined') {
    setInterval(cleanup, 60000);
  }

  return {
    check(identifier: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(identifier);

      // If no entry or expired, create new one
      if (!entry || entry.resetAt <= now) {
        store.set(identifier, {
          count: 1,
          resetAt: now + interval,
        });
        return {
          success: true,
          remaining: limit - 1,
          reset: now + interval,
        };
      }

      // Increment count
      entry.count++;

      // Check if over limit
      if (entry.count > limit) {
        return {
          success: false,
          remaining: 0,
          reset: entry.resetAt,
        };
      }

      return {
        success: true,
        remaining: limit - entry.count,
        reset: entry.resetAt,
      };
    },

    reset(identifier: string): void {
      store.delete(identifier);
    },
  };
}

// Pre-configured rate limiters for common use cases

/** Auth rate limiter: 5 attempts per minute per IP */
export const authRateLimiter = createRateLimiter({
  interval: 60 * 1000, // 1 minute
  limit: 5,
});

/** API rate limiter: 100 requests per minute per user */
export const apiRateLimiter = createRateLimiter({
  interval: 60 * 1000, // 1 minute
  limit: 100,
});

/** Webhook rate limiter: 30 requests per minute per source */
export const webhookRateLimiter = createRateLimiter({
  interval: 60 * 1000, // 1 minute
  limit: 30,
});

/** Strict rate limiter: 3 attempts per 5 minutes (for sensitive operations) */
export const strictRateLimiter = createRateLimiter({
  interval: 5 * 60 * 1000, // 5 minutes
  limit: 3,
});

/**
 * Get client IP from request headers
 * Handles common proxy headers (X-Forwarded-For, X-Real-IP)
 */
export function getClientIP(request: Request): string {
  const headers = request.headers;

  // Check X-Forwarded-For (may be comma-separated list)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }

  // Check X-Real-IP
  const realIP = headers.get('x-real-ip');
  if (realIP) return realIP;

  // Fallback to a default identifier
  return 'unknown';
}
