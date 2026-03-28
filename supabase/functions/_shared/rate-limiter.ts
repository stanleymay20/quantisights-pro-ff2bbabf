/**
 * Simple in-memory rate limiter for edge functions.
 * Uses a sliding window approach per organization.
 * Note: Resets on function cold-start. For production-critical
 * rate limiting, consider a database-backed solution.
 */
import { getCorsHeaders } from "./cors.ts";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimitResponse(retryAfterMs: number, req?: Request): Response {
  const headers = req ? getCorsHeaders(req) : getCorsHeaders();

  return new Response(
    JSON.stringify({ error: "Rate limit exceeded", retry_after_ms: retryAfterMs }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        ...headers,
      },
    }
  );
}
