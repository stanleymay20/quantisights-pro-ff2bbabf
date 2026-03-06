import { describe, it, expect } from "vitest";
import { generateRecommendation } from "@/lib/decision-recommendation";
import { scoreDecisionQuality, buildConfidenceBasis } from "@/lib/evidence-contract";
import { computeCostOfDelay } from "@/lib/cost-of-delay";

describe("Decision Intelligence Integrity Tests", () => {
  describe("Recommendation Engine — Evidence Contract", () => {
    it("every recommendation must include assumptions", () => {
      const rec = generateRecommendation({
        signalType: "signal", severity: "high", confidence: 60, message: "Revenue declined 15% in Q4",
      });
      expect(rec.assumptions).toBeDefined();
      expect(rec.assumptions.length).toBeGreaterThan(0);
    });

    it("every recommendation must include riskIfWrong", () => {
      const rec = generateRecommendation({
        signalType: "signal", severity: "critical", confidence: 80, message: "Churn spiked to 18%",
      });
      expect(rec.riskIfWrong).toBeDefined();
      expect(rec.riskIfWrong.length).toBeGreaterThan(10);
    });

    it("every recommendation must include confidenceBasis", () => {
      const rec = generateRecommendation({
        signalType: "advisory", severity: "medium", confidence: 55, message: "Cost trend rising",
      });
      expect(rec.confidenceBasis).toBeDefined();
      expect(rec.confidenceBasis.label).toBeTruthy();
    });

    it("every recommendation must include qualityScore", () => {
      const rec = generateRecommendation({
        signalType: "signal", severity: "high", confidence: 70, message: "Margin compression detected across segments",
      });
      expect(rec.qualityScore).toBeDefined();
      expect(rec.qualityScore.overall).toBeGreaterThanOrEqual(0);
      expect(rec.qualityScore.overall).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D", "F"]).toContain(rec.qualityScore.grade);
    });

    it("low-evidence recommendations must be flagged as non-decision-grade", () => {
      const rec = generateRecommendation({
        signalType: "proactive", severity: "low", confidence: 20,
        // No message, no diagnostics, no causal factors
      });
      // With minimal evidence, quality should be lower
      expect(rec.qualityScore.grade).not.toBe("A");
    });
  });

  describe("Cost of Delay — No Fabricated Currency", () => {
    it("must NOT show currency without predictedNetImpact", () => {
      const result = computeCostOfDelay({
        severity: "high", confidence: 70, revenue: 1000000,
      });
      // Without predictedNetImpact, should show relative score, not €
      expect(result.estimatedDelayCost).toContain("Relative score");
      expect(result.estimatedDelayCost).not.toContain("€");
    });

    it("must show currency ONLY with validated predictedNetImpact", () => {
      const result = computeCostOfDelay({
        severity: "high", confidence: 70, predictedNetImpact: 50000,
      });
      expect(result.estimatedDelayCost).toContain("€");
      expect(result.estimatedDelayCost).toContain("/week");
    });
  });

  describe("Decision Quality Scoring", () => {
    it("full evidence block scores high", () => {
      const score = scoreDecisionQuality({
        observation: "Revenue declined 15% over 3 months across all segments",
        evidence: ["Q1: €2.1M → Q3: €1.78M", "All 4 segments affected", "Accelerating trend"],
        reasoning: "Sustained multi-segment decline suggests structural issue, not seasonal",
        confidenceBasis: buildConfidenceBasis({ sampleSize: 45, calibrationApplied: true }),
        assumptions: ["Trend will continue without intervention"],
        limitations: [],
        recommendation: "Investigate root cause via diagnostic engine and monitor KPI weekly",
        expectedImpact: "Prevent further 5-10% decline (€89K-€178K quarterly)",
        riskIfWrong: "If seasonal, intervention cost is wasted but limited to investigation resources",
      });
      expect(score.grade).toBe("A");
      expect(score.isDecisionGrade).toBe(true);
    });

    it("empty evidence block scores F", () => {
      const score = scoreDecisionQuality({});
      expect(score.grade).toBe("F");
      expect(score.isDecisionGrade).toBe(false);
      expect(score.downgradeReason).toBeTruthy();
    });
  });

  describe("Confidence Basis — Never Unjustified", () => {
    it("heuristic confidence must be labeled", () => {
      const basis = buildConfidenceBasis({ sampleSize: 5, isHeuristic: true });
      expect(basis.label).toContain("Heuristic");
      expect(basis.isHeuristic).toBe(true);
      expect(basis.signalStrength).toBe("weak");
    });

    it("calibrated confidence must be labeled", () => {
      const basis = buildConfidenceBasis({ sampleSize: 50, calibrationApplied: true });
      expect(basis.label).toContain("Calibrated");
      expect(basis.calibrationApplied).toBe(true);
      expect(basis.signalStrength).toBe("strong");
    });
  });
});
