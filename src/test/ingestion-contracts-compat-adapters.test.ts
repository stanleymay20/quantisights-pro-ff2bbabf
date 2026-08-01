import { describe, expect, it } from "vitest";
// Real, production functions -- not reimplemented. This is the exact
// anti-pattern the audit flagged in enterprise-data-integration.test.ts
// (§8): a test suite that duplicates production logic inline instead of
// importing it, so a real regression wouldn't be caught. These adapter
// tests import and call the actual legacy pipeline.
import { computeDiagnostics, inferSchema, type ColumnMapping } from "@/lib/data-upload-utils";
import { classifySemanticSchema } from "@/lib/semantic-column-classifier";
import { parseCSVText } from "@/lib/data-upload-utils";
import {
  checksumForParsedTable,
  fromCsvParseResult,
  fromLegacyDetectedSchema,
  fromLegacyDiagnostics,
  fromLegacySemanticProfiles,
} from "@/lib/ingestion-contracts/compat";
import { ParsedTabularDataSchema } from "@/lib/ingestion-contracts";

const MULTI_DATE_CSV = `order_date,ship_date,customer_id,revenue
2024-01-15,2024-01-18,CUST-001,1200.50
2024-02-03,2024-02-06,CUST-002,3400.00
2024-02-20,2024-02-24,CUST-003,890.25
2024-03-05,2024-03-09,CUST-004,5600.75
2024-03-22,2024-03-25,CUST-005,2100.10
2024-04-01,2024-04-04,CUST-006,780.00
`;

describe("Compatibility adapters: real production functions -> canonical contracts", () => {
  it("fromCsvParseResult wraps the real parseCSVText output into a valid ParsedTabularData", () => {
    const parsed = parseCSVText(MULTI_DATE_CSV);
    expect(parsed.headers).toEqual(["order_date", "ship_date", "customer_id", "revenue"]);

    const result = fromCsvParseResult(parsed, "orders.csv");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const validated = ParsedTabularDataSchema.safeParse(result.value);
    expect(validated.success).toBe(true);
    expect(result.value.totalRowCount).toBe(parsed.rows.length);
  });

  it("fromCsvParseResult produces a structured error (not a throw, not a silent partial result) for a headerless input", () => {
    const parsed = parseCSVText(""); // real function's own documented empty-input behavior: { headers: [], rows: [] }
    const result = fromCsvParseResult(parsed, "empty.csv");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("physical_parsing");
    expect(result.error.severity).toBe("fatal");
    expect(result.error.userMessage).toBeTruthy();
    expect(result.error.technicalMessage).toBeTruthy();
  });

  it("fromLegacyDetectedSchema recovers a date-family structural role for the column the REAL inferSchema demoted to 'segment'", () => {
    const parsed = parseCSVText(MULTI_DATE_CSV);
    const detected = inferSchema(parsed.headers, parsed.rows);

    // Confirm the legacy demotion actually fired against this real fixture
    // -- if it didn't, the recovery test below would be vacuous.
    const demoted = detected.find((d) => d.rulesApplied.includes("single_date_rule:demoted_to_segment"));
    expect(demoted).toBeDefined();
    expect(demoted?.inferredType).toBe("segment"); // legacy output: information already lost at this layer

    const { structuralRoles } = fromLegacyDetectedSchema(detected, "orders.csv");
    const recoveredProposal = structuralRoles.find((p) => p.fieldId === `orders.csv:${demoted!.colIdx}`);
    expect(recoveredProposal).toBeDefined();

    // The canonical contract does NOT inherit the legacy demotion --
    // it's recovered to a real date-family role via the rulesApplied tag.
    const dateFamilyRoles = ["event_timestamp", "reporting_period", "transaction_date"];
    expect(dateFamilyRoles).toContain(recoveredProposal!.proposedRole);
    expect(recoveredProposal!.contradictoryEvidence.length).toBeGreaterThan(0);
    expect(recoveredProposal!.reviewRequired).toBe(true);
  });

  it("fromLegacyDetectedSchema does not alter the still-primary date column's role", () => {
    const parsed = parseCSVText(MULTI_DATE_CSV);
    const detected = inferSchema(parsed.headers, parsed.rows);
    const primaryDate = detected.find((d) => d.inferredType === "date");
    expect(primaryDate).toBeDefined();

    const { structuralRoles } = fromLegacyDetectedSchema(detected, "orders.csv");
    const primaryProposal = structuralRoles.find((p) => p.fieldId === `orders.csv:${primaryDate!.colIdx}`);
    expect(primaryProposal!.proposedRole).toBe("transaction_date");
    expect(primaryProposal!.contradictoryEvidence).toHaveLength(0);
  });

  it("evidenceScore in the canonical contract equals the legacy confidence literal, carried through honestly rather than re-labeled as calibrated", () => {
    const parsed = parseCSVText(MULTI_DATE_CSV);
    const detected = inferSchema(parsed.headers, parsed.rows);
    const { physicalTypes } = fromLegacyDetectedSchema(detected, "orders.csv");

    const revenueDetection = detected.find((d) => d.column === "revenue")!;
    const revenueProposal = physicalTypes.find((p) => p.fieldId === `orders.csv:${revenueDetection.colIdx}`)!;
    expect(revenueProposal.evidenceScore).toBe(revenueDetection.confidence);
  });

  it("fromLegacySemanticProfiles wraps the real classifySemanticSchema output", () => {
    const parsed = parseCSVText(MULTI_DATE_CSV);
    const detected = inferSchema(parsed.headers, parsed.rows);
    const semantic = classifySemanticSchema({ schema: detected, rows: parsed.rows });
    expect(semantic.profiles.length).toBe(detected.length);

    const mappings = fromLegacySemanticProfiles(semantic.profiles, "orders.csv");
    expect(mappings).toHaveLength(semantic.profiles.length);

    const revenueProfile = semantic.profiles.find((p) => p.column === "revenue")!;
    const revenueMapping = mappings.find((m) => m.fieldId === `orders.csv:${revenueProfile.colIdx}`)!;
    expect(revenueMapping.proposedConcept).toBe(`${revenueProfile.businessRole}:${revenueProfile.semanticType}`);
    expect(revenueMapping.evidenceScore).toBe(revenueProfile.confidence);
    expect(revenueMapping.reviewRequired).toBe(revenueProfile.reviewRequired);
  });

  it("fromLegacyDiagnostics wraps the real computeDiagnostics output into evidence records", () => {
    const parsed = parseCSVText(MULTI_DATE_CSV);
    const detected = inferSchema(parsed.headers, parsed.rows);
    const mapping: ColumnMapping = Object.fromEntries(detected.map((d) => [d.colIdx, d.inferredType]));
    const diagnostics = computeDiagnostics(parsed.rows, parsed.headers, mapping, detected);

    const evidence = fromLegacyDiagnostics(diagnostics);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((e) => e.observedStatistic.length > 0)).toBe(true);
    expect(evidence.every((e) => e.ruleOrMethod === "legacy:computeDiagnostics")).toBe(true);
  });

  it("checksumForParsedTable is stable for identical content and changes when content changes", () => {
    const parsedA = parseCSVText(MULTI_DATE_CSV);
    const parsedB = parseCSVText(MULTI_DATE_CSV);
    expect(checksumForParsedTable(parsedA.headers, parsedA.rows)).toBe(checksumForParsedTable(parsedB.headers, parsedB.rows));

    const parsedDifferent = parseCSVText(MULTI_DATE_CSV.replace("CUST-001", "CUST-999"));
    expect(checksumForParsedTable(parsedA.headers, parsedA.rows)).not.toBe(
      checksumForParsedTable(parsedDifferent.headers, parsedDifferent.rows),
    );
  });
});
