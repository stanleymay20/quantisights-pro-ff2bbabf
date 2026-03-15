/**
 * Standardized rate-limiting guard for all authenticated edge functions.
 * Provides per-org rate limiting with sensible defaults by function category.
 * 
 * Usage:
 *   import { applyRateLimit } from "../_shared/rate-guard.ts";
 *   const rl = applyRateLimit(req, orgId, "intelligence");
 *   if (rl) return rl; // 429 response
 */
import { checkRateLimit, rateLimitResponse } from "./rate-limiter.ts";

type FunctionCategory =
  | "intelligence"   // AI-powered analysis (expensive)
  | "query"          // Data reads (moderate)
  | "mutation"       // Data writes
  | "export"         // Data exports
  | "simulation"     // Monte Carlo / scenario simulations
  | "webhook"        // External webhook ingestion
  | "public";        // Unauthenticated public endpoints

const LIMITS: Record<FunctionCategory, { max: number; windowMs: number }> = {
  intelligence: { max: 20, windowMs: 60_000 },       // 20/min per org
  query:        { max: 60, windowMs: 60_000 },        // 60/min per org
  mutation:     { max: 30, windowMs: 60_000 },        // 30/min per org
  export:       { max: 5,  windowMs: 3600_000 },      // 5/hr per org
  simulation:   { max: 10, windowMs: 60_000 },        // 10/min per org
  webhook:      { max: 100, windowMs: 60_000 },       // 100/min per source
  public:       { max: 10, windowMs: 60_000 },        // 10/min per IP
};

/**
 * Apply rate limiting. Returns null if allowed, or a 429 Response if blocked.
 * @param req - The incoming request (used for IP fallback)
 * @param scopeId - Organization ID or IP address for public endpoints
 * @param category - The function category for limit selection
 * @param functionName - Optional function name for granular keys
 */
export function applyRateLimit(
  req: Request,
  scopeId: string,
  category: FunctionCategory,
  functionName?: string
): Response | null {
  const limit = LIMITS[category];
  const key = functionName
    ? `${category}:${functionName}:${scopeId}`
    : `${category}:${scopeId}`;

  const { allowed, retryAfterMs } = checkRateLimit(key, limit.max, limit.windowMs);
  if (!allowed) return rateLimitResponse(retryAfterMs);
  return null;
}

/**
 * Extract client IP from request headers (for public endpoint rate limiting)
 */
export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
