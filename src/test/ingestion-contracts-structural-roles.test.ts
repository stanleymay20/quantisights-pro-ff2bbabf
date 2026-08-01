import { describe, expect, it } from "vitest";
import { computeFieldProfile, inferStructuralRoles } from "@/lib/ingestion-contracts";

// Phase brief item 7 / audit §4.6: the legacy inferSchema keeps exactly
// one "date" column and force-demotes every other date-like column to a
// generic "segment", losing its time-dimension role. This new, additive
// inference must preserve all of them with distinct roles.
describe("inferStructuralRoles: preserves multiple date columns", () => {
  const checksum = "multi-date-fixture";

  function dateProfile(header: string, colIdx: number, values: string[]) {
    return computeFieldProfile({
      sheetOrTableIdentity: "orders",
      originalHeader: header,
      originalColumnPosition: colIdx,
      columnValues: values,
      sourceChecksum: checksum,
    });
  }

  it("order_date, ship_date, delivery_date, invoice_date, payment_date all retain a date-family role", () => {
    const dateValues = ["2024-01-15", "2024-02-01", "2024-03-10", "2024-04-22", "2024-05-05"];
    const profiles = [
      dateProfile("order_date", 0, dateValues),
      dateProfile("ship_date", 1, dateValues),
      dateProfile("delivery_date", 2, dateValues),
      dateProfile("invoice_date", 3, dateValues),
      dateProfile("payment_date", 4, dateValues),
    ];

    const proposals = inferStructuralRoles(profiles);
    expect(proposals).toHaveLength(5);

    const dateFamilyRoles: string[] = ["event_timestamp", "reporting_period", "transaction_date"];
    for (const proposal of proposals) {
      expect(dateFamilyRoles).toContain(proposal.proposedRole);
      // None of them collapse to a generic non-date role the way the
      // legacy single-date rule would.
      expect(proposal.proposedRole).not.toBe("dimension");
      expect(proposal.proposedRole).not.toBe("descriptive_text");
      expect(proposal.evidence.length).toBeGreaterThan(0);
    }
  });

  it("header hints route order/invoice/payment dates to transaction_date and ship/deliver dates to event_timestamp", () => {
    const dateValues = ["2024-01-15", "2024-02-01", "2024-03-10"];
    const orderDate = inferStructuralRoles([dateProfile("order_date", 0, dateValues)])[0];
    const shipDate = inferStructuralRoles([dateProfile("ship_date", 1, dateValues)])[0];

    expect(orderDate.proposedRole).toBe("transaction_date");
    expect(shipDate.proposedRole).toBe("event_timestamp");
  });

  it("a genuinely non-date column is not misclassified as a date role", () => {
    const profile = dateProfile("customer_name", 5, ["Acme Corp", "Globex", "Initech", "Umbrella", "Wayne Ent."]);
    const proposal = inferStructuralRoles([profile])[0];
    expect(["event_timestamp", "reporting_period", "transaction_date"]).not.toContain(proposal.proposedRole);
  });

  it("evidenceScore is present and bounded, and is not labeled as a calibrated confidence anywhere in the contract", () => {
    const profile = dateProfile("order_date", 0, ["2024-01-15", "2024-02-01", "2024-03-10"]);
    const proposal = inferStructuralRoles([profile])[0];
    expect(proposal.evidenceScore).toBeGreaterThanOrEqual(0);
    expect(proposal.evidenceScore).toBeLessThanOrEqual(100);
    expect(Object.keys(proposal)).not.toContain("confidence");
    expect(Object.keys(proposal)).not.toContain("calibratedConfidence");
  });
});
