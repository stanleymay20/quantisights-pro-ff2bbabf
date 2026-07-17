import { describe, expect, it } from "vitest";
import {
  asDatasetId,
  asIngestionRunId,
  asOrganizationId,
  asSourceId,
  makeEvidence,
  makeProcessingError,
  makePhysicalTypeProposal,
  makeSemanticMapping,
  makeStructuralRoleProposal,
  ParsedTabularDataSchema,
  SourceIdentitySchema,
} from "@/lib/ingestion-contracts";

function validEvidence() {
  return makeEvidence({
    evidenceType: "header_pattern",
    description: "test evidence",
    sourceLocation: { column: 0 },
    observedStatistic: "numericRate=0.9",
    ruleOrMethod: "test",
    weight: 0.5,
    stance: "supporting",
  });
}

describe("Canonical ingestion contracts: Zod validation", () => {
  it("branded IDs reject empty strings", () => {
    expect(() => asOrganizationId("")).toThrow();
    expect(() => asDatasetId("")).toThrow();
    expect(() => asSourceId("org-1")).not.toThrow();
    expect(() => asIngestionRunId("run-1")).not.toThrow();
  });

  it("SourceIdentitySchema rejects a payload missing required fields", () => {
    const result = SourceIdentitySchema.safeParse({ organizationId: "org-1" });
    expect(result.success).toBe(false);
  });

  it("SourceIdentitySchema accepts a complete, valid payload", () => {
    const result = SourceIdentitySchema.safeParse({
      organizationId: "org-1",
      sourceId: "src-1",
      ingestionRunId: "run-1",
      sourceType: "csv_upload",
      filenameOrSourceIdentifier: "revenue.csv",
      checksum: "abc123",
      ingestionTimestamp: new Date().toISOString(),
      parserName: "parseCSVText",
      parserVersion: "legacy",
      processingStatus: "pending",
    });
    expect(result.success).toBe(true);
  });

  it("ParsedTabularDataSchema rejects malformed rows (missing required cell fields)", () => {
    const result = ParsedTabularDataSchema.safeParse({
      sheetOrTableIdentity: "Sheet1",
      headers: ["revenue"],
      rows: [{ originalRowNumber: 0, cells: [{ originalColumnPosition: 0 }] }], // missing rawValue/normalizedValue
      totalRowCount: 1,
      parsingEvidence: {
        parserName: "test",
        parserVersion: "1",
        headerRowIndex: 0,
        detectionMethod: "test",
      },
    });
    expect(result.success).toBe(false);
  });

  it("a proposal without at least one evidence record is rejected", () => {
    expect(() =>
      makePhysicalTypeProposal({
        fieldId: "sheet:0",
        proposedType: "decimal",
        evidence: [],
        contradictoryEvidence: [],
        evidenceScore: 90,
        alternativesConsidered: [],
        mappingMethod: "test",
        reviewRequired: false,
        ruleOrModelVersion: "v1",
      }),
    ).toThrow();
  });

  it("evidenceScore is bounded to 0-100, not treated as a 0-1 probability", () => {
    expect(() =>
      makeStructuralRoleProposal({
        fieldId: "sheet:0",
        proposedRole: "metric",
        evidence: [validEvidence()],
        contradictoryEvidence: [],
        evidenceScore: 150,
        alternativesConsidered: [],
        mappingMethod: "test",
        reviewRequired: false,
        ruleOrModelVersion: "v1",
      }),
    ).toThrow();
  });

  it("SemanticMapping requires an open-vocabulary proposedConcept string, not a fixed enum", () => {
    const mapping = makeSemanticMapping({
      fieldId: "sheet:0",
      proposedConcept: "revenue",
      evidence: [validEvidence()],
      contradictoryEvidence: [],
      evidenceScore: 80,
      alternativesConsidered: ["gross_revenue"],
      mappingMethod: "test",
      reviewRequired: false,
      ruleOrModelVersion: "v1",
    });
    expect(mapping.proposedConcept).toBe("revenue");
  });

  it("ProcessingError requires both a user-facing and a technical explanation", () => {
    const result = makeProcessingError({
      code: "empty_headers",
      stage: "physical_parsing",
      severity: "fatal",
      userMessage: "This file has no header row.",
      technicalMessage: "headers.length === 0",
      retryable: false,
      suggestedAction: "Re-upload with a header row.",
    });
    expect(result.userMessage).not.toBe(result.technicalMessage);
    expect(result.occurredAt).toBeTruthy();
  });
});
