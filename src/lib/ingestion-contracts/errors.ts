// Structured processing errors. Every adapter boundary that can fail must
// return one of these instead of throwing past the caller or silently
// returning a partial/null result -- the failure mode the audit found
// repeatedly (buildIngestionIntelligence, discoverCrossSheetRelationships,
// schema-drift detection all swallow errors into `console.warn` + `null`).
import { z } from "zod";
import { IngestionRunIdSchema, SourceIdSchema } from "./ids";

export const ProcessingStageSchema = z.enum([
  "source_acquisition",
  "physical_parsing",
  "field_profiling",
  "physical_type_inference",
  "structural_role_inference",
  "semantic_mapping",
  "relationship_detection",
  "validation",
  "persistence",
]);
export type ProcessingStage = z.infer<typeof ProcessingStageSchema>;

export const ErrorSeveritySchema = z.enum(["info", "warning", "error", "fatal"]);
export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;

export const ProcessingErrorSchema = z.object({
  code: z.string().min(1),
  stage: ProcessingStageSchema,
  severity: ErrorSeveritySchema,
  sourceId: SourceIdSchema.optional(),
  ingestionRunId: IngestionRunIdSchema.optional(),
  sheetOrTable: z.string().optional(),
  row: z.number().int().nonnegative().optional(),
  column: z.union([z.string(), z.number().int().nonnegative()]).optional(),
  // Only populated when it is safe to surface (not PII-flagged, not from a
  // sensitive_attribute-tagged field) -- callers constructing this must
  // decide that, this contract does not infer safety on its own.
  rawValueIfSafe: z.string().optional(),
  userMessage: z.string().min(1),
  technicalMessage: z.string().min(1),
  retryable: z.boolean(),
  suggestedAction: z.string().min(1),
  occurredAt: z.string().datetime(),
});
export type ProcessingError = z.infer<typeof ProcessingErrorSchema>;

export function makeProcessingError(input: Omit<ProcessingError, "occurredAt">): ProcessingError {
  return ProcessingErrorSchema.parse({ ...input, occurredAt: new Date().toISOString() });
}

/**
 * Result type every contract-boundary function should return instead of
 * throwing: malformed input produces a structured error, never a partial
 * "looks like it worked" value.
 */
export type ContractResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProcessingError };

export function ok<T>(value: T): ContractResult<T> {
  return { ok: true, value };
}

export function fail<T>(error: ProcessingError): ContractResult<T> {
  return { ok: false, error };
}
