// Compatibility adapter: converts the REAL, production
// `classifySemanticSchema()`/`classifySemanticColumn()` output
// (src/lib/semantic-column-classifier.ts, `SemanticColumnProfile[]`) into
// the canonical SemanticMapping[] contract. The classifier itself is not
// modified.
//
// Honesty note: the legacy classifier only ever produces a coarse
// businessRole (e.g. "financial_kpi") plus a semanticType (e.g.
// "currency"), never a specific named concept like "revenue" vs. "cost"
// within that role -- see audit §4.2. This adapter does not invent
// specificity the source data doesn't have; proposedConcept is the
// composite of the two coarse labels, and a later phase's genuine
// concept-level semantic mapper is expected to supersede it, not this
// adapter pretending to be more precise than its input.
import type { SemanticColumnProfile } from "@/lib/semantic-column-classifier";
import { makeEvidence } from "../evidence";
import { makeSemanticMapping, type SemanticMapping } from "../inference";

const ADAPTER_METHOD = "compat:from-semantic-classification:v1";

function fieldIdFor(sheetOrTableIdentity: string, profile: SemanticColumnProfile): string {
  return `${sheetOrTableIdentity}:${profile.colIdx}`;
}

export function fromLegacySemanticProfiles(
  profiles: SemanticColumnProfile[],
  sheetOrTableIdentity: string = "csv",
): SemanticMapping[] {
  return profiles.map((profile) =>
    makeSemanticMapping({
      fieldId: fieldIdFor(sheetOrTableIdentity, profile),
      proposedConcept:
        profile.businessRole === "unknown" && profile.semanticType === "unknown"
          ? "unknown"
          : `${profile.businessRole}:${profile.semanticType}`,
      evidence: [
        makeEvidence({
          evidenceType: "header_pattern",
          description: profile.reason,
          sourceLocation: { column: profile.colIdx },
          observedStatistic: `rulesApplied=[${profile.rulesApplied.join(",")}]`,
          ruleOrMethod: "legacy:classifySemanticColumn",
          weight: 1,
          stance: "supporting",
        }),
      ],
      contradictoryEvidence: [],
      // Carried through verbatim from the legacy hardcoded literal --
      // still not a calibrated probability just because it now lives in a
      // field named evidenceScore instead of confidence.
      evidenceScore: profile.confidence,
      alternativesConsidered: [],
      mappingMethod: ADAPTER_METHOD,
      reviewRequired: profile.reviewRequired,
      ruleOrModelVersion: "legacy:classifySemanticColumn",
    }),
  );
}
