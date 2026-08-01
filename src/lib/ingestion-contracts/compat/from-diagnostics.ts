// Compatibility adapter: converts the REAL, production
// `computeDiagnostics()` output (src/lib/data-upload-utils.ts,
// `DatasetDiagnostics`) into canonical EvidenceRecord[].
//
// This closes the specific persistence gap the audit flagged in §5.2:
// diagnostics (missing %, duplicate rows, PII columns, health score) are
// computed by the legacy pipeline and shown to the user once, but none of
// those fields exist in the snapshot that actually reaches Postgres
// (toIngestionMetadataSnapshot). Wrapping them as EvidenceRecord[] here
// doesn't yet change what gets persisted (that's a DataUpload.tsx wiring
// change, out of scope for Phase 1 per the plan) -- it makes the
// information representable in the canonical contract so a later phase
// can persist it without re-deriving it.
import type { DatasetDiagnostics } from "@/lib/data-upload-utils";
import { makeEvidence, type EvidenceRecord } from "../evidence";

const RULE = "legacy:computeDiagnostics";

export function fromLegacyDiagnostics(diagnostics: DatasetDiagnostics): EvidenceRecord[] {
  const records: EvidenceRecord[] = [
    makeEvidence({
      evidenceType: "sample_statistic",
      description: "missing-value rate across the dataset",
      sourceLocation: {},
      observedStatistic: `missingValuesPct=${diagnostics.missingValuesPct}`,
      ruleOrMethod: RULE,
      weight: 0.5,
      stance: diagnostics.missingValuesPct > 20 ? "contradicting" : "neutral",
    }),
    makeEvidence({
      evidenceType: "sample_statistic",
      description: "exact and near-duplicate row counts",
      sourceLocation: {},
      observedStatistic: `duplicateRows=${diagnostics.duplicateRows},nearDuplicateRows=${diagnostics.nearDuplicateRows}`,
      ruleOrMethod: RULE,
      weight: 0.4,
      stance: diagnostics.duplicateRows > 0 ? "contradicting" : "neutral",
    }),
    makeEvidence({
      evidenceType: "sample_statistic",
      description: "date continuity across the primary date column",
      sourceLocation: {},
      observedStatistic: `dateContinuity=${diagnostics.dateContinuity},dateGapCount=${diagnostics.dateGapCount}`,
      ruleOrMethod: RULE,
      weight: 0.3,
      stance: diagnostics.dateContinuity === "Gaps detected" ? "contradicting" : "neutral",
    }),
    makeEvidence({
      evidenceType: "sample_statistic",
      description: "overall dataset health/completeness score",
      sourceLocation: {},
      observedStatistic: `healthScore=${diagnostics.healthScore},completenessScore=${diagnostics.completenessScore},recommendedAction=${diagnostics.recommendedAction}`,
      ruleOrMethod: RULE,
      weight: 0.6,
      stance: diagnostics.recommendedAction === "Proceed with Import" ? "supporting" : "contradicting",
    }),
  ];

  for (const column of diagnostics.piiRisk.columns) {
    records.push(
      makeEvidence({
        evidenceType: "header_pattern",
        description: `column flagged as potential PII by legacy diagnostics (risk level: ${diagnostics.piiRisk.level})`,
        sourceLocation: { column },
        observedStatistic: `piiRiskLevel=${diagnostics.piiRisk.level}`,
        ruleOrMethod: RULE,
        weight: 0.7,
        stance: "contradicting",
      }),
    );
  }

  return records;
}
