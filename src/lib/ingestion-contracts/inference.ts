// The three inference layers, kept structurally separate per the phase
// brief: a field's physical type, its structural role, and its business
// meaning are different questions with different evidence, and collapsing
// them into one 7-value ColumnTarget (as the legacy inferSchema does) is
// exactly what loses information -- see the audit's §4.7 finding.
//
// None of the scores in this file are calibrated probabilities. They are
// named `evidenceScore` everywhere, on purpose, so nothing downstream can
// accidentally present a rule-strength heuristic as a statistical
// confidence the way the legacy `confidence: 90`-style literals do (audit
// §4.5). A future calibration phase can introduce a genuinely calibrated
// field alongside this one; it must not reuse this name.
import { z } from "zod";
import { EvidenceRecordSchema } from "./evidence";

export const PhysicalTypeSchema = z.enum([
  "string",
  "integer",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "duration",
  "currency",
  "percentage",
  "ratio",
  "identifier",
  "categorical",
  "free_text",
  "unknown",
]);
export type PhysicalType = z.infer<typeof PhysicalTypeSchema>;

export const StructuralRoleSchema = z.enum([
  "primary_key_candidate",
  "foreign_key_candidate",
  "composite_key_member",
  "metric",
  "dimension",
  "event_timestamp",
  "reporting_period",
  "transaction_date",
  "status",
  "entity_attribute",
  "unit_field",
  "currency_field",
  "descriptive_text",
  "unknown",
]);
export type StructuralRole = z.infer<typeof StructuralRoleSchema>;

const ProposalBase = z.object({
  fieldId: z.string().min(1),
  evidence: z.array(EvidenceRecordSchema).min(1, "a proposal must carry at least one evidence record"),
  contradictoryEvidence: z.array(EvidenceRecordSchema).default([]),
  evidenceScore: z.number().min(0).max(100),
  alternativesConsidered: z.array(z.string()).default([]),
  mappingMethod: z.string().min(1), // e.g. "rule_cascade:legacy_infer_schema_compat", "rule_cascade:v1"
  reviewRequired: z.boolean(),
  ruleOrModelVersion: z.string().min(1),
  proposedAt: z.string().datetime(),
});

export const PhysicalTypeProposalSchema = ProposalBase.extend({
  proposedType: PhysicalTypeSchema,
});
export type PhysicalTypeProposal = z.infer<typeof PhysicalTypeProposalSchema>;

export const StructuralRoleProposalSchema = ProposalBase.extend({
  proposedRole: StructuralRoleSchema,
});
export type StructuralRoleProposal = z.infer<typeof StructuralRoleProposalSchema>;

export const SemanticMappingSchema = ProposalBase.extend({
  proposedConcept: z.string().min(1), // e.g. "revenue", "customer", "order_date" -- open vocabulary, not a fixed enum, per the "organisation-specific terminology" requirement
});
export type SemanticMapping = z.infer<typeof SemanticMappingSchema>;

function withDefaults<T extends Record<string, unknown>>(
  input: Omit<T, "proposedAt"> & { proposedAt?: string },
): T {
  return { ...input, proposedAt: input.proposedAt ?? new Date().toISOString() } as T;
}

export function makePhysicalTypeProposal(
  input: Omit<PhysicalTypeProposal, "proposedAt"> & { proposedAt?: string },
): PhysicalTypeProposal {
  return PhysicalTypeProposalSchema.parse(withDefaults(input));
}

export function makeStructuralRoleProposal(
  input: Omit<StructuralRoleProposal, "proposedAt"> & { proposedAt?: string },
): StructuralRoleProposal {
  return StructuralRoleProposalSchema.parse(withDefaults(input));
}

export function makeSemanticMapping(
  input: Omit<SemanticMapping, "proposedAt"> & { proposedAt?: string },
): SemanticMapping {
  return SemanticMappingSchema.parse(withDefaults(input));
}
