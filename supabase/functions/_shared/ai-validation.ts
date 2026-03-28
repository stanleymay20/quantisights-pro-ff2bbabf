/**
 * AI Output Schema Validation
 * Validates and sanitizes AI model outputs before they enter the data pipeline.
 */

export interface InsightSchema {
  message: string;
  severity: "high" | "medium" | "info";
  category: string;
  raw_confidence: number;
}

export interface NarrativeSchema {
  content: string;
  maxLength: number;
}

const VALID_SEVERITIES = new Set(["high", "medium", "info"]);
const VALID_CATEGORIES = new Set([
  "trend", "anomaly", "risk", "opportunity", "segmentation",
  "correlation", "driver", "seasonality", "changepoint",
  "distribution", "benchmark", "general",
]);

/**
 * Validates a single AI-generated insight object.
 * Returns the validated insight or null if invalid.
 */
export function validateInsight(raw: unknown): InsightSchema | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // message: required non-empty string
  if (typeof obj.message !== "string" || obj.message.trim().length < 10) return null;

  // severity: must be valid enum
  const severity = typeof obj.severity === "string" ? obj.severity.toLowerCase() : "info";
  if (!VALID_SEVERITIES.has(severity)) return null;

  // category: must be valid enum, default to "general"
  const category = typeof obj.category === "string" ? obj.category.toLowerCase() : "general";
  const validCategory = VALID_CATEGORIES.has(category) ? category : "general";

  // raw_confidence: number between 0-100
  let confidence = typeof obj.raw_confidence === "number" ? obj.raw_confidence : 70;
  if (!Number.isFinite(confidence)) confidence = 70;
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    message: obj.message.trim(),
    severity: severity as InsightSchema["severity"],
    category: validCategory,
    raw_confidence: Math.round(confidence),
  };
}

/**
 * Validates and filters an array of AI-generated insights.
 * Returns only valid insights.
 */
export function validateInsightArray(raw: unknown): InsightSchema[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(validateInsight).filter((i): i is InsightSchema => i !== null);
}

/**
 * Validates AI narrative text output.
 * Returns sanitized text or empty string.
 */
export function validateNarrative(text: unknown, maxLength = 2000): string {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length > maxLength) return trimmed.slice(0, maxLength) + "…";
  return trimmed;
}

/**
 * Checks if AI output contains suspicious patterns that indicate hallucination.
 */
export function detectHallucination(
  text: string,
  knownEntities: Set<string>
): { suspicious: boolean; reason?: string } {
  if (!text || text.length < 10) return { suspicious: true, reason: "Output too short" };

  // Check for common hallucination patterns
  const hallucPatterns = [
    /I (?:don't|do not|cannot) have access/i,
    /as an AI/i,
    /I (?:can't|cannot) provide/i,
    /hypothetical/i,
    /I (?:would|might) suggest/i,
  ];

  for (const pattern of hallucPatterns) {
    if (pattern.test(text)) {
      return { suspicious: true, reason: `Matches hallucination pattern: ${pattern.source}` };
    }
  }

  return { suspicious: false };
}
