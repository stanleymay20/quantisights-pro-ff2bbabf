// Evidence records back every inference the canonical contracts make.
// A mapping without evidence is not a mapping this system should be able
// to produce -- see the "no insight should exist without source
// references" principle from the mission.
import { z } from "zod";

export const EvidenceStanceSchema = z.enum(["supporting", "contradicting", "neutral"]);
export type EvidenceStance = z.infer<typeof EvidenceStanceSchema>;

export const EvidenceTypeSchema = z.enum([
  "header_pattern",
  "value_pattern",
  "value_distribution",
  "sample_statistic",
  "cross_column_signal",
  "cross_sheet_signal",
  "user_correction",
  "prior_mapping_memory",
  "model_output",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const SourceLocationSchema = z.object({
  sheetOrTable: z.string().optional(),
  column: z.union([z.string(), z.number().int().nonnegative()]).optional(),
  rowRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
});
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

export const EvidenceRecordSchema = z.object({
  evidenceType: EvidenceTypeSchema,
  description: z.string().min(1),
  sourceLocation: SourceLocationSchema,
  // A short, human-readable statistic string ("numericRate=0.94",
  // "overlap=0.82 over 1000 sampled values") rather than a typed union of
  // every possible statistic shape -- evidence is heterogeneous by nature
  // and this keeps the contract from having to enumerate every metric
  // every future rule might produce.
  observedStatistic: z.string().min(1),
  ruleOrMethod: z.string().min(1),
  // Relative weight this evidence carries toward the final evidence score,
  // 0-1. Not a probability on its own -- see inference.ts's doc comment on
  // why the aggregate is never called a calibrated confidence.
  weight: z.number().min(0).max(1),
  stance: EvidenceStanceSchema,
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export function makeEvidence(input: EvidenceRecord): EvidenceRecord {
  return EvidenceRecordSchema.parse(input);
}
