import { describe, expect, it } from "vitest";
import { pickPriorityDecision, type ReviewableDecision } from "@/components/decisions/executive-review-flow";

function decision(overrides: Partial<ReviewableDecision>): ReviewableDecision {
  return {
    id: "d1",
    recommended_action: "Do something",
    predicted_net_impact: null,
    capped_confidence: null,
    explanation_metadata: null,
    ...overrides,
  } as ReviewableDecision;
}

describe("pickPriorityDecision", () => {
  it("returns null for an empty list", () => {
    expect(pickPriorityDecision([])).toBeNull();
  });

  it("prefers an evidence-verified decision over a higher-impact one missing evidence", () => {
    // Round 4 audit finding: Executive Brief picked a 55%-confidence,
    // evidence-missing decision ("Reduce infrastructure costs by
    // migrating to serverless architecture", €95,000 impact) as "the one
    // decision that most needs your judgment right now" over decisions
    // that actually have evidence attached, purely because it had the
    // largest predicted_net_impact.
    const noEvidence = decision({
      id: "infra-migration",
      predicted_net_impact: 95000,
      capped_confidence: 55,
      evidence_sources: [],
      explanation_metadata: {},
    } as Partial<ReviewableDecision>);
    const withEvidence = decision({
      id: "cfo-risk-escalation",
      predicted_net_impact: 11,
      capped_confidence: 72,
      evidence_sources: [{ source_type: "advisory", source_name: "Risk model", source_id: "a1" }],
    } as Partial<ReviewableDecision>);

    expect(pickPriorityDecision([noEvidence, withEvidence])?.id).toBe("cfo-risk-escalation");
  });

  it("ranks by predicted_net_impact among decisions that all have evidence", () => {
    const low = decision({
      id: "low-impact",
      predicted_net_impact: 40000,
      evidence_sources: [{ source_type: "advisory", source_name: "x", source_id: "1" }],
    } as Partial<ReviewableDecision>);
    const high = decision({
      id: "high-impact",
      predicted_net_impact: 420000,
      evidence_sources: [{ source_type: "advisory", source_name: "y", source_id: "2" }],
    } as Partial<ReviewableDecision>);

    expect(pickPriorityDecision([low, high])?.id).toBe("high-impact");
  });

  it("falls back to the highest-impact decision when none have evidence, rather than returning nothing", () => {
    const a = decision({ id: "a", predicted_net_impact: 5000 } as Partial<ReviewableDecision>);
    const b = decision({ id: "b", predicted_net_impact: 12000 } as Partial<ReviewableDecision>);

    expect(pickPriorityDecision([a, b])?.id).toBe("b");
  });
});
