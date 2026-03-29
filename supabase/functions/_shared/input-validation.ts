/**
 * Input validation schemas for Edge Functions.
 * Provides Zod-like validation without external dependencies.
 * Keeps edge functions lean while enforcing strict input contracts.
 */

export type ValidationError = { field: string; message: string };

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/** Validate a UUID v4 string */
export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Validate a non-empty trimmed string with max length */
export function isValidString(value: unknown, maxLength = 2000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/** Validate an enum value */
export function isValidEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/** Validate a positive integer */
export function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Validate an ISO date string */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value.slice(0, 10));
}

/**
 * Validate the common "Active Data Contract" fields required by all analytical edge functions.
 */
export function validateActiveDataContract(
  body: Record<string, unknown>
): ValidationResult<{ organization_id: string; dataset_id: string }> {
  const errors: ValidationError[] = [];

  if (!isValidUUID(body.organization_id)) {
    errors.push({ field: "organization_id", message: "Must be a valid UUID" });
  }
  if (!isValidUUID(body.dataset_id)) {
    errors.push({ field: "dataset_id", message: "Must be a valid UUID (required by Active Data Contract)" });
  }

  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: { organization_id: body.organization_id as string, dataset_id: body.dataset_id as string } };
}

/**
 * Validate execute-decision-action create_plan inputs.
 */
export function validateCreatePlan(body: Record<string, unknown>): ValidationResult<{
  decision_id: string;
  action_title: string;
  action_description: string | null;
  owner_user_id: string | null;
  priority: string;
  deadline: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
}> {
  const errors: ValidationError[] = [];

  if (!isValidUUID(body.decision_id)) {
    errors.push({ field: "decision_id", message: "Must be a valid UUID" });
  }
  if (!isValidString(body.action_title, 500)) {
    errors.push({ field: "action_title", message: "Required string, max 500 chars" });
  }
  if (body.action_description !== undefined && body.action_description !== null && !isValidString(body.action_description, 2000)) {
    errors.push({ field: "action_description", message: "Must be string, max 2000 chars" });
  }
  if (body.owner_user_id !== undefined && body.owner_user_id !== null && !isValidUUID(body.owner_user_id)) {
    errors.push({ field: "owner_user_id", message: "Must be a valid UUID" });
  }

  const validPriorities = ["critical", "high", "medium", "low"] as const;
  const priority = isValidEnum(body.priority, validPriorities) ? body.priority : "medium";

  if (body.deadline !== undefined && body.deadline !== null && !isValidISODate(body.deadline)) {
    errors.push({ field: "deadline", message: "Must be a valid ISO date" });
  }

  const validTriggers = ["manual", "webhook", "scheduled", "slack"] as const;
  const trigger_type = isValidEnum(body.trigger_type, validTriggers) ? body.trigger_type : "manual";

  if (errors.length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      decision_id: body.decision_id as string,
      action_title: (body.action_title as string).trim().slice(0, 500),
      action_description: body.action_description ? String(body.action_description).trim().slice(0, 2000) : null,
      owner_user_id: (body.owner_user_id as string) || null,
      priority,
      deadline: (body.deadline as string) || null,
      trigger_type,
      trigger_config: (body.trigger_config && typeof body.trigger_config === "object" ? body.trigger_config : {}) as Record<string, unknown>,
    },
  };
}

/**
 * Build a 400 error response from validation errors.
 */
export function validationErrorResponse(
  errors: ValidationError[],
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: "Validation failed", details: errors }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
