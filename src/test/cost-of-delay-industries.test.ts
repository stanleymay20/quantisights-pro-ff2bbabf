import { describe, it, expect } from "vitest";
import { computeCostOfDelay, type CostOfDelayInput } from "../lib/cost-of-delay";
import { generateRecommendation, type RecommendationInput } from "../lib/decision-recommendation";

// Helper: base input for CoD
function codInput(overrides: Partial<CostOfDelayInput> = {}): CostOfDelayInput {
  return {
    severity: "high",
    confidence: 70,
    revenue: 10_000_000,
    ageDays: 5,
    ...overrides,
  };
}

// Helper: base input for recommendations
function recInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    signalType: "signal",
    severity: "high",
    confidence: 70,
    sampleSize: 50,
    ...overrides,
  };
}

describe("Cost of Delay — Cross-Industry Scoring", () => {
  describe("Metric urgency multipliers", () => {
    it("safety metrics score higher than generic", () => {
      const safety = computeCostOfDelay(codInput({ affectedMetricType: "safety_incident_rate" }));
      const generic = computeCostOfDelay(codInput({ affectedMetricType: "misc_metric" }));
      expect(safety.score).toBeGreaterThan(generic.score);
    });

    it("patient/mortality metrics have highest urgency", () => {
      const mortality = computeCostOfDelay(codInput({ affectedMetricType: "mortality_rate" }));
      const revenue = computeCostOfDelay(codInput({ affectedMetricType: "revenue" }));
      expect(mortality.score).toBeGreaterThan(revenue.score);
    });

    it("compliance metrics score higher than growth", () => {
      const compliance = computeCostOfDelay(codInput({ affectedMetricType: "compliance_breach" }));
      const growth = computeCostOfDelay(codInput({ affectedMetricType: "growth" }));
      expect(compliance.score).toBeGreaterThan(growth.score);
    });

    it("fraud urgency exceeds revenue urgency", () => {
      const fraud = computeCostOfDelay(codInput({ affectedMetricType: "fraud_detection" }));
      const rev = computeCostOfDelay(codInput({ affectedMetricType: "revenue" }));
      expect(fraud.score).toBeGreaterThan(rev.score);
    });

    it("outage urgency matches regulatory", () => {
      const outage = computeCostOfDelay(codInput({ affectedMetricType: "outage" }));
      const reg = computeCostOfDelay(codInput({ affectedMetricType: "regulatory" }));
      expect(outage.score).toBe(reg.score);
    });

    it("downtime has higher urgency than inventory", () => {
      const downtime = computeCostOfDelay(codInput({ affectedMetricType: "downtime" }));
      const inventory = computeCostOfDelay(codInput({ affectedMetricType: "inventory" }));
      expect(downtime.score).toBeGreaterThan(inventory.score);
    });
  });

  describe("Revenue exposure tiers", () => {
    const base = { severity: "high" as const, confidence: 80, revenue: 1_000_000, ageDays: 0 };

    it("Tier 1 (safety) uses ~10% base rate", () => {
      const r = computeCostOfDelay(codInput({ ...base, affectedMetricType: "safety" }));
      expect(r.estimatedDelayCost).toContain("/week");
      expect(r.estimatedDelayCost).toContain("exposure");
    });

    it("Tier 2 (churn) uses ~8% base rate", () => {
      const r = computeCostOfDelay(codInput({ ...base, affectedMetricType: "churn" }));
      expect(r.estimatedDelayCost).toContain("/week");
    });

    it("Tier 3 (revenue) uses ~7% base rate", () => {
      const r = computeCostOfDelay(codInput({ ...base, affectedMetricType: "revenue" }));
      expect(r.estimatedDelayCost).toContain("/week");
    });

    it("Tier 4 (yield) uses ~6% base rate", () => {
      const r = computeCostOfDelay(codInput({ ...base, affectedMetricType: "yield" }));
      expect(r.estimatedDelayCost).toContain("/week");
    });

    it("predictedNetImpact overrides revenue-based estimate", () => {
      const r = computeCostOfDelay(codInput({ ...base, predictedNetImpact: -50000 }));
      expect(r.estimatedDelayCost).toContain("/week");
      expect(r.estimatedDelayCost).not.toContain("exposure");
    });
  });

  describe("Expected impact keyword bonuses", () => {
    it("critical keywords boost score", () => {
      const withKeyword = computeCostOfDelay(codInput({ expectedImpact: "Catastrophic system failure" }));
      const without = computeCostOfDelay(codInput({}));
      expect(withKeyword.score).toBeGreaterThan(without.score);
    });

    it("safety + compounding keywords stack", () => {
      const stacked = computeCostOfDelay(codInput({ expectedImpact: "Safety hazard with cascading compounding effects" }));
      const single = computeCostOfDelay(codInput({ expectedImpact: "Minor improvement opportunity" }));
      expect(stacked.score).toBeGreaterThan(single.score);
    });

    it("operational disruption keywords add bonus", () => {
      const outage = computeCostOfDelay(codInput({ expectedImpact: "Complete system outage affecting production" }));
      const baseline = computeCostOfDelay(codInput({}));
      expect(outage.score).toBeGreaterThan(baseline.score);
    });
  });

  describe("Score bounds and labels", () => {
    it("score is always 0-100", () => {
      const extreme = computeCostOfDelay(codInput({
        severity: "critical", confidence: 100, signalDelta: 200,
        affectedEntityCount: 10000, trendAccelerating: true,
        affectedMetricType: "mortality", ageDays: 100,
        expectedImpact: "Catastrophic cascading safety hazard with fatality risk",
      }));
      expect(extreme.score).toBeLessThanOrEqual(100);
      expect(extreme.score).toBeGreaterThanOrEqual(0);
    });

    it("low severity + low confidence = low label", () => {
      const r = computeCostOfDelay(codInput({ severity: "low", confidence: 20, revenue: 0, ageDays: 0 }));
      expect(r.label).toBe("low");
    });

    it("critical severity + high confidence = critical label", () => {
      const r = computeCostOfDelay(codInput({
        severity: "critical", confidence: 95, affectedMetricType: "safety",
        trendAccelerating: true, ageDays: 30,
      }));
      expect(["critical", "high"]).toContain(r.label);
    });
  });

  describe("Action window decay", () => {
    it("older signals get shorter action windows", () => {
      const fresh = computeCostOfDelay(codInput({ ageDays: 0, severity: "high" }));
      const old = computeCostOfDelay(codInput({ ageDays: 30, severity: "high" }));
      expect(old.recommendedActionWindowDays).toBeLessThanOrEqual(fresh.recommendedActionWindowDays);
    });
  });
});

describe("Decision Recommendation — Cross-Industry Owners", () => {
  it("safety → VP EHS", () => {
    const r = generateRecommendation(recInput({ category: "safety" }));
    expect(r.suggestedOwner).toContain("EHS");
  });

  it("patient → CMO", () => {
    const r = generateRecommendation(recInput({ metricType: "patient_outcome" }));
    expect(r.suggestedOwner).toContain("CMO");
  });

  it("compliance → CCO", () => {
    const r = generateRecommendation(recInput({ category: "compliance" }));
    expect(r.suggestedOwner).toContain("CCO");
  });

  it("fraud → CRO", () => {
    const r = generateRecommendation(recInput({ category: "fraud" }));
    expect(r.suggestedOwner).toContain("CRO");
  });

  it("downtime → VP Operations", () => {
    const r = generateRecommendation(recInput({ metricType: "downtime" }));
    expect(r.suggestedOwner).toContain("Operations");
  });

  it("emission → Sustainability", () => {
    const r = generateRecommendation(recInput({ metricType: "emission" }));
    expect(r.suggestedOwner).toContain("Sustainability");
  });

  it("enrollment → Enrollment Management", () => {
    const r = generateRecommendation(recInput({ metricType: "enrollment" }));
    expect(r.suggestedOwner).toContain("Enrollment");
  });

  it("occupancy → Revenue Management", () => {
    const r = generateRecommendation(recInput({ metricType: "occupancy" }));
    expect(r.suggestedOwner).toContain("Revenue Management");
  });

  it("unknown metric → generic owner", () => {
    const r = generateRecommendation(recInput({ metricType: "xyz_unknown" }));
    expect(r.suggestedOwner).toBe("Decision Owner (assign)");
  });
});

describe("Decision Recommendation — Cross-Industry Success Metrics", () => {
  const cases: [string, string, string][] = [
    ["patient", "patient_outcome", "Patient outcome"],
    ["safety", "trir", "TRIR"],
    ["compliance", "regulatory_audit", "Compliance gap"],
    ["fraud", "fraud_detection", "Fraud detection"],
    ["manufacturing", "downtime", "MTTR"],
    ["manufacturing", "defect_rate", "Defect rate"],
    ["supply chain", "inventory_turnover", "Inventory turnover"],
    ["energy", "emission_intensity", "Carbon intensity"],
    ["education", "enrollment_rate", "Retention/enrollment"],
    ["hospitality", "occupancy_rate", "Occupancy rate"],
    ["saas", "churn_rate", "churn rate"],
    ["finance", "revenue", "MRR"],
  ];

  it.each(cases)("category=%s metric=%s → metrics contain '%s'", (cat, met, expected) => {
    const r = generateRecommendation(recInput({ category: cat, metricType: met }));
    const joined = r.successMetrics.join(" ");
    expect(joined.toLowerCase()).toContain(expected.toLowerCase());
  });
});

describe("Decision Recommendation — Cross-Industry Actions", () => {
  it("patient category triggers clinical safety review", () => {
    const r = generateRecommendation(recInput({ category: "patient", message: "Patient adverse event spike detected in ICU ward" }));
    expect(r.recommendedAction.toLowerCase()).toContain("clinical");
  });

  it("compliance triggers gap assessment", () => {
    const r = generateRecommendation(recInput({ category: "compliance", message: "Regulatory compliance gap identified in quarterly audit" }));
    expect(r.recommendedAction.toLowerCase()).toContain("compliance");
  });

  it("fraud triggers investigation", () => {
    const r = generateRecommendation(recInput({ category: "fraud", message: "Suspicious transaction pattern detected across accounts" }));
    expect(r.recommendedAction.toLowerCase()).toContain("fraud");
  });

  it("downtime triggers incident response", () => {
    const r = generateRecommendation(recInput({ metricType: "downtime", message: "Production line downtime exceeded threshold this week" }));
    expect(r.recommendedAction.toLowerCase()).toContain("root cause");
  });

  it("defect triggers Pareto analysis", () => {
    const r = generateRecommendation(recInput({ metricType: "defect", message: "Defect rate spiked 15% in batch production run" }));
    expect(r.recommendedAction.toLowerCase()).toContain("pareto");
  });

  it("inventory triggers supply chain assessment", () => {
    const r = generateRecommendation(recInput({ metricType: "inventory", message: "Inventory stockout risk increasing for critical components" }));
    expect(r.recommendedAction.toLowerCase()).toContain("supply chain");
  });
});
