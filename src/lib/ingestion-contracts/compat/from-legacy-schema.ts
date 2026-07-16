// Compatibility adapter: converts the REAL, production `inferSchema()`
// output (src/lib/data-upload-utils.ts, `DetectedSchema[]`) into the
// canonical PhysicalTypeProposal[] + StructuralRoleProposal[] contracts.
// inferSchema itself is not modified.
//
// The one piece of real recovery logic here: inferSchema demotes every
// date column but the highest-confidence one to a generic "segment" role,
// tagging the demoted rows with "single_date_rule:demoted_to_segment" in
// rulesApplied (data-upload-utils.ts:497). That tag is the only surviving
// signal that a "segment" column was actually date-like. This adapter
// detects it and restores a date-family structural role instead of
// carrying the loss forward into the canonical contract -- see phase
// brief item 7 / audit §4.6.
import type { ColumnTarget, DetectedSchema } from "@/lib/data-upload-utils";
import { makeEvidence } from "../evidence";
import {
  makePhysicalTypeProposal,
  makeStructuralRoleProposal,
  type PhysicalType,
  type PhysicalTypeProposal,
  type StructuralRole,
  type StructuralRoleProposal,
} from "../inference";
import { proposeDateRoleFromHeader } from "../infer-structural-roles";

const ADAPTER_METHOD = "compat:from-legacy-schema:v1";
const DEMOTED_DATE_TAG = "single_date_rule:demoted_to_segment";

function normalizeHeaderForRoleHint(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function physicalTypeForTarget(target: ColumnTarget): PhysicalType {
  switch (target) {
    case "date":
      return "date";
    case "value":
      return "decimal";
    case "region":
    case "region_code":
    case "segment":
    case "metric_type":
      return "categorical";
    case "skip":
      return "unknown";
    default:
      return "unknown";
  }
}

function structuralRoleForTarget(detection: DetectedSchema): StructuralRole {
  const wasDemotedDate = detection.rulesApplied.includes(DEMOTED_DATE_TAG);
  if (wasDemotedDate) {
    return proposeDateRoleFromHeader(normalizeHeaderForRoleHint(detection.column));
  }

  switch (detection.inferredType) {
    case "date":
      return "transaction_date";
    case "value":
      return "metric";
    case "region":
    case "region_code":
      return "dimension";
    case "segment":
      return "dimension";
    case "metric_type":
      return "dimension";
    case "skip":
    default:
      return "unknown";
  }
}

function fieldIdFor(sheetOrTableIdentity: string, detection: DetectedSchema): string {
  return `${sheetOrTableIdentity}:${detection.colIdx}`;
}

function evidenceFromDetection(detection: DetectedSchema) {
  return [
    makeEvidence({
      evidenceType: "sample_statistic",
      description: detection.reason,
      sourceLocation: { column: detection.colIdx },
      observedStatistic: `rulesApplied=[${detection.rulesApplied.join(",")}]`,
      ruleOrMethod: "legacy:inferSchema",
      weight: 1,
      stance: "supporting",
    }),
    makeEvidence({
      evidenceType: "value_pattern",
      description: "sample values inspected by legacy inferSchema",
      sourceLocation: { column: detection.colIdx },
      observedStatistic: `sampleValues=[${detection.sampleValues.slice(0, 5).join(",")}]`,
      ruleOrMethod: "legacy:inferSchema",
      weight: 0.5,
      stance: "neutral",
    }),
  ];
}

export function fromLegacyDetectedSchema(
  detections: DetectedSchema[],
  sheetOrTableIdentity: string = "csv",
): { physicalTypes: PhysicalTypeProposal[]; structuralRoles: StructuralRoleProposal[] } {
  const physicalTypes: PhysicalTypeProposal[] = [];
  const structuralRoles: StructuralRoleProposal[] = [];

  for (const detection of detections) {
    const fieldId = fieldIdFor(sheetOrTableIdentity, detection);
    const evidence = evidenceFromDetection(detection);
    const wasDemotedDate = detection.rulesApplied.includes(DEMOTED_DATE_TAG);

    physicalTypes.push(
      makePhysicalTypeProposal({
        fieldId,
        // The physical type is "date" for both the winning date column and
        // any date column the legacy rule demoted -- physical type is not
        // where the information loss happened, structural role is.
        proposedType: wasDemotedDate ? "date" : physicalTypeForTarget(detection.inferredType),
        evidence,
        contradictoryEvidence: [],
        evidenceScore: detection.confidence,
        alternativesConsidered: wasDemotedDate ? ["categorical (legacy demoted this to segment)"] : [],
        mappingMethod: ADAPTER_METHOD,
        reviewRequired: detection.confidence < 70,
        ruleOrModelVersion: "legacy:inferSchema",
      }),
    );

    structuralRoles.push(
      makeStructuralRoleProposal({
        fieldId,
        proposedRole: structuralRoleForTarget(detection),
        evidence,
        contradictoryEvidence: wasDemotedDate
          ? [
              makeEvidence({
                evidenceType: "cross_column_signal",
                description: "legacy single-date rule demoted this column because another column had higher date confidence",
                sourceLocation: { column: detection.colIdx },
                observedStatistic: "single_date_rule:demoted_to_segment",
                ruleOrMethod: "legacy:inferSchema",
                weight: 0.3,
                stance: "contradicting",
              }),
            ]
          : [],
        evidenceScore: wasDemotedDate ? Math.max(50, detection.confidence - 15) : detection.confidence,
        alternativesConsidered: wasDemotedDate ? ["dimension (legacy assigned this)"] : [],
        mappingMethod: ADAPTER_METHOD,
        reviewRequired: wasDemotedDate || detection.confidence < 70,
        ruleOrModelVersion: "legacy:inferSchema",
      }),
    );
  }

  return { physicalTypes, structuralRoles };
}
