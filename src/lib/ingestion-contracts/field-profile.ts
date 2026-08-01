// Canonical field-profile contract: defensible statistics about a single
// column, computed under a recorded sampling strategy rather than an
// unstated "first 100 rows" convention.
import { z } from "zod";
import { SamplingStrategySchema } from "./sampling";

export const FieldProfileSchema = z.object({
  fieldId: z.string().min(1), // stable id, e.g. `${sheetOrTableIdentity}:${originalColumnPosition}`
  originalHeader: z.string(),
  normalizedHeader: z.string(),
  originalColumnPosition: z.number().int().nonnegative(),

  samplingStrategy: SamplingStrategySchema,

  nullRate: z.number().min(0).max(1),
  distinctCount: z.number().int().nonnegative(),
  approximateCardinality: z.boolean(),

  numericRate: z.number().min(0).max(1),
  dateRate: z.number().min(0).max(1),
  booleanRate: z.number().min(0).max(1),
  identifierLikelihood: z.number().min(0).max(1),
  piiLikelihood: z.number().min(0).max(1),

  detectedFormats: z.array(z.string()).default([]), // e.g. "ISO-8601", "EU-decimal-comma", "excel-serial"
  representativeValues: z.array(z.string()).max(20),
  anomalies: z.array(z.string()).default([]),
});
export type FieldProfile = z.infer<typeof FieldProfileSchema>;
