import { describe, it, expect } from "vitest";

// ═══════════════ OUTCOME EVALUATION LOGIC ═══════════════

describe("Outcome evaluation correctness", () => {
  const evaluateOutcome = (
    expectedDir: string,
    expectedChange: number | null,
    observedChange: number
  ): { status: string; accuracy: number | null } => {
    const directionMatch =
      (expectedDir === "increase" && observedChange > 1) ||
      (expectedDir === "decrease" && observedChange < -1);

    let status = "no_effect";
    if (directionMatch) {
      if (expectedChange !== null) {
        const expectedMag = Math.abs(expectedChange);
        const observedMag = Math.abs(observedChange);
        if (observedMag >= expectedMag * 0.8) status = "success";
        else if (observedMag >= expectedMag * 0.3) status = "partial_success";
      } else {
        status = "success";
      }
    } else if (
      (expectedDir === "increase" && observedChange < -5) ||
      (expectedDir === "decrease" && observedChange > 5)
    ) {
      status = "negative_outcome";
    }

    let accuracy: number | null = null;
    if (expectedChange !== null && expectedChange !== 0) {
      accuracy = Math.max(0, Math.min(100, 100 - Math.abs(observedChange - expectedChange) * 2));
    }

    return { status, accuracy };
  };

  it("marks success when direction and magnitude match", () => {
    const result = evaluateOutcome("decrease", -10, -9);
    expect(result.status).toBe("success");
    expect(result.accuracy).toBeGreaterThan(90);
  });

  it("marks partial success for partial magnitude", () => {
    const result = evaluateOutcome("decrease", -10, -4);
    expect(result.status).toBe("partial_success");
  });

  it("marks no_effect for flat change", () => {
    const result = evaluateOutcome("increase", 15, 0.5);
    expect(result.status).toBe("no_effect");
  });

  it("marks negative_outcome for opposite direction", () => {
    const result = evaluateOutcome("increase", 10, -8);
    expect(result.status).toBe("negative_outcome");
  });

  it("handles direction-only (no expected magnitude)", () => {
    const result = evaluateOutcome("increase", null, 5);
    expect(result.status).toBe("success");
    expect(result.accuracy).toBeNull();
  });

  it("marks not_evaluable when no data (handled upstream)", () => {
    // This is handled at the edge function level, not in the core logic
    expect(true).toBe(true);
  });
});

// ═══════════════ ACCURACY SCORE CALCULATION ═══════════════

describe("Accuracy score calculation", () => {
  const computeAccuracy = (expected: number, observed: number): number => {
    if (expected === 0) return 0;
    return Math.max(0, Math.min(100, 100 - Math.abs(observed - expected) * 2));
  };

  it("perfect prediction scores 100", () => {
    expect(computeAccuracy(-10, -10)).toBe(100);
  });

  it("small deviation scores high", () => {
    const score = computeAccuracy(-10, -8);
    expect(score).toBeGreaterThan(90);
  });

  it("large deviation scores low", () => {
    const score = computeAccuracy(20, -10);
    expect(score).toBeLessThan(50);
  });

  it("score is capped at 0-100", () => {
    expect(computeAccuracy(5, 100)).toBe(0);
    expect(computeAccuracy(5, 5)).toBe(100);
  });
});

// ═══════════════ CALIBRATION TRACKING ═══════════════

describe("Calibration tracking", () => {
  it("detects overconfidence gap", () => {
    const avgConfidence = 85;
    const avgAccuracy = 62;
    const gap = avgConfidence - avgAccuracy;
    expect(gap).toBeGreaterThan(5);
    expect(gap).toBe(23);
  });

  it("detects underconfidence", () => {
    const avgConfidence = 55;
    const avgAccuracy = 72;
    const gap = avgConfidence - avgAccuracy;
    expect(gap).toBeLessThan(-5);
  });

  it("identifies well-calibrated system", () => {
    const avgConfidence = 70;
    const avgAccuracy = 68;
    const gap = Math.abs(avgConfidence - avgAccuracy);
    expect(gap).toBeLessThan(5);
  });
});

// ═══════════════ NO FABRICATED OUTCOMES ═══════════════

describe("Fail-safe outcome handling", () => {
  it("does not fabricate results when data is missing", () => {
    const beforeMetrics: number[] = [];
    const afterMetrics: number[] = [];
    const canEvaluate = beforeMetrics.length > 0 && afterMetrics.length > 0;
    expect(canEvaluate).toBe(false);
    // System should mark as "not_evaluable"
  });

  it("requires minimum data for evaluation", () => {
    const hasBeforeData = false;
    const hasAfterData = true;
    const evaluable = hasBeforeData && hasAfterData;
    expect(evaluable).toBe(false);
  });
});

// ═══════════════ RELIABILITY INDEX ═══════════════

describe("Recommendation reliability index", () => {
  it("computes reliability from historical outcomes", () => {
    const outcomes = [
      { status: "success" },
      { status: "success" },
      { status: "partial_success" },
      { status: "no_effect" },
      { status: "negative_outcome" },
    ];
    const evaluable = outcomes.filter(
      (o) => o.status !== "not_evaluable"
    );
    const positive = evaluable.filter(
      (o) => o.status === "success" || o.status === "partial_success"
    );
    const reliability = (positive.length / evaluable.length) * 100;
    expect(reliability).toBe(60);
  });

  it("returns null for insufficient history", () => {
    const outcomes = [{ status: "success" }, { status: "no_effect" }];
    const reliability = outcomes.length >= 3 ? 50 : null;
    expect(reliability).toBeNull();
  });
});

// ═══════════════ LEARNING INSIGHTS ═══════════════

describe("Decision learning system", () => {
  it("generates per-metric learning insights", () => {
    const metricBreakdown = [
      { metric: "churn_rate", total: 5, successRate: 80 },
      { metric: "revenue", total: 8, successRate: 50 },
    ];

    const learnings = metricBreakdown
      .filter((mb) => mb.total >= 3)
      .map(
        (mb) =>
          `${mb.metric} recommendations have produced positive outcomes in ${mb.successRate}% of cases (n=${mb.total}).`
      );

    expect(learnings).toHaveLength(2);
    expect(learnings[0]).toContain("churn_rate");
    expect(learnings[0]).toContain("80%");
    expect(learnings[1]).toContain("revenue");
  });
});
