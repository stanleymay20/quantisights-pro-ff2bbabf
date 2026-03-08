import { describe, it, expect } from "vitest";
import {
  mean, variance, stdDev, median, iterativeMin, iterativeMax,
  pearsonCorrelation, spearmanCorrelation,
  twoSampleTTest,
  detectAnomalies, rollingDeviationAnomalies,
  detectTrend,
  segmentationAnalysis,
  driverAnalysis,
  evidenceConfidence,
  checkSufficiency,
  runFullAnalysis,
  generateAnalystNote,
} from "@/lib/analysis-engine";

// ═══════════════ CORE STATISTICS ═══════════════

describe("Core statistics", () => {
  it("computes mean correctly", () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(mean([])).toBe(0);
  });

  it("computes variance and stdDev", () => {
    const vals = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(variance(vals)).toBeCloseTo(4, 0);
    expect(stdDev(vals)).toBeCloseTo(2, 0);
  });

  it("computes median", () => {
    expect(median([1, 3, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("uses iterative min/max (no spread)", () => {
    const large = Array.from({ length: 50000 }, (_, i) => i);
    expect(iterativeMin(large)).toBe(0);
    expect(iterativeMax(large)).toBe(49999);
  });
});

// ═══════════════ CORRELATION ═══════════════

describe("Correlation analysis", () => {
  it("computes perfect positive Pearson correlation", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    const result = pearsonCorrelation(a, b);
    expect(result).not.toBeNull();
    expect(result!.r).toBeCloseTo(1.0, 5);
    expect(result!.pValue).toBeLessThan(0.01);
  });

  it("computes negative Pearson correlation", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 8, 6, 4, 2];
    const result = pearsonCorrelation(a, b);
    expect(result).not.toBeNull();
    expect(result!.r).toBeCloseTo(-1.0, 5);
  });

  it("returns null for insufficient data", () => {
    expect(pearsonCorrelation([1, 2], [3, 4])).toBeNull();
  });

  it("computes Spearman rank correlation", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    const result = spearmanCorrelation(a, b);
    expect(result).not.toBeNull();
    expect(result!.rho).toBeCloseTo(1.0, 3);
  });

  it("handles ties in Spearman", () => {
    const a = [1, 1, 3, 4, 5];
    const b = [2, 2, 6, 8, 10];
    const result = spearmanCorrelation(a, b);
    expect(result).not.toBeNull();
    expect(result!.rho).toBeGreaterThan(0.9);
  });
});

// ═══════════════ HYPOTHESIS TESTING ═══════════════

describe("Hypothesis testing (t-test)", () => {
  it("detects significant difference between groups", () => {
    const a = [100, 105, 110, 95, 102, 108, 103, 107];
    const b = [50, 55, 48, 52, 60, 45, 53, 58];
    const result = twoSampleTTest(a, b);
    expect(result).not.toBeNull();
    expect(result!.pValue).toBeLessThan(0.01);
    expect(Math.abs(result!.effectSize)).toBeGreaterThan(0.8); // large effect
    expect(result!.ci95[0]).toBeGreaterThan(0); // entire CI above 0
  });

  it("returns non-significant for similar groups", () => {
    const a = [100, 102, 98, 101, 99, 103];
    const b = [101, 99, 100, 102, 98, 100];
    const result = twoSampleTTest(a, b);
    expect(result).not.toBeNull();
    expect(result!.pValue).toBeGreaterThan(0.05);
    expect(Math.abs(result!.effectSize)).toBeLessThan(0.5);
  });

  it("returns null for tiny samples", () => {
    expect(twoSampleTTest([1, 2], [3, 4])).toBeNull();
  });

  it("includes Cohen's d effect size", () => {
    const a = [10, 12, 11, 13, 14];
    const b = [20, 22, 21, 23, 24];
    const result = twoSampleTTest(a, b);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.effectSize)).toBeGreaterThan(1); // very large
  });
});

// ═══════════════ ANOMALY DETECTION ═══════════════

describe("Anomaly detection", () => {
  it("detects z-score outliers", () => {
    // Need >10 data points so 1 outlier is <10%
    const vals = [10, 11, 10, 12, 11, 10, 11, 10, 12, 11, 10, 50];
    const anomalies = detectAnomalies(vals, 2);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].value).toBe(50);
    expect(anomalies[0].zScore).toBeGreaterThan(2);
  });

  it("returns empty for insufficient data", () => {
    expect(detectAnomalies([1, 2, 3])).toHaveLength(0);
  });

  it("ignores datasets with too many outliers (>10%)", () => {
    // When >10% are "outliers", it's likely the distribution, not anomalies
    const vals = [1, 1, 1, 100, 100, 100, 1, 1, 1, 100];
    const anomalies = detectAnomalies(vals, 1);
    expect(anomalies).toHaveLength(0);
  });

  it("rolling deviation detects contextual anomalies", () => {
    // Need variance in the window so stdDev > 0
    const vals = [10, 11, 10, 12, 11, 10, 11, 10, 12, 11, 50];
    const anomalies = rollingDeviationAnomalies(vals, 7, 2);
    expect(anomalies.length).toBeGreaterThan(0);
  });
});

// ═══════════════ TREND DETECTION ═══════════════

describe("Trend detection", () => {
  it("detects significant upward trend", () => {
    const vals = [10, 12, 11, 13, 20, 22, 25, 28];
    const result = detectTrend(vals);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("increased");
    expect(result!.changePct).toBeGreaterThan(10);
    expect(result!.slope).toBeGreaterThan(0);
  });

  it("detects significant downward trend", () => {
    const vals = [100, 95, 90, 85, 50, 45, 40, 35];
    const result = detectTrend(vals);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("decreased");
  });

  it("returns null for flat data", () => {
    const vals = [100, 101, 99, 100, 100, 101, 99, 100];
    expect(detectTrend(vals)).toBeNull();
  });

  it("returns null for insufficient data", () => {
    expect(detectTrend([1, 2, 3])).toBeNull();
  });
});

// ═══════════════ SEGMENTATION ═══════════════

describe("Segmentation analysis", () => {
  it("detects segment disparity", () => {
    const rows = [
      { id: "1", metric_type: "revenue", value: 100, date: "2026-01", region: null, segment: "Enterprise" },
      { id: "2", metric_type: "revenue", value: 110, date: "2026-02", region: null, segment: "Enterprise" },
      { id: "3", metric_type: "revenue", value: 30, date: "2026-01", region: null, segment: "SMB" },
      { id: "4", metric_type: "revenue", value: 25, date: "2026-02", region: null, segment: "SMB" },
    ];
    const result = segmentationAnalysis(rows);
    expect(result).not.toBeNull();
    expect(result!.spread).toBeGreaterThan(15);
    expect(result!.segments[0].segment).toBe("Enterprise");
    expect(result!.segments[0].shareOfTotal).toBeGreaterThan(50);
  });

  it("returns null for single segment", () => {
    const rows = [
      { id: "1", metric_type: "x", value: 10, date: "2026-01", region: null, segment: "A" },
    ];
    expect(segmentationAnalysis(rows)).toBeNull();
  });
});

// ═══════════════ DRIVER ANALYSIS ═══════════════

describe("Driver analysis", () => {
  it("identifies primary driver of change", () => {
    const byType = new Map<string, number[]>();
    byType.set("leads", [100, 100, 100, 100, 80, 75, 70, 65]); // big decline
    byType.set("conversion", [10, 10, 10, 10, 9, 9, 9, 9]); // small decline
    byType.set("deal_size", [50, 50, 50, 50, 50, 50, 50, 50]); // stable

    const result = driverAnalysis(byType);
    expect(result).not.toBeNull();
    expect(result![0].metric).toBe("leads");
    expect(result![0].contribution).toBeGreaterThan(50);
  });

  it("returns null for insufficient metrics", () => {
    const byType = new Map<string, number[]>();
    byType.set("single", [1, 2, 3, 4]);
    expect(driverAnalysis(byType)).toBeNull();
  });
});

// ═══════════════ CONFIDENCE FROM EVIDENCE ═══════════════

describe("Evidence-based confidence", () => {
  it("caps at 90% per epistemic policy", () => {
    expect(evidenceConfidence(1000, 0.001)).toBeLessThanOrEqual(90);
  });

  it("penalizes high p-values", () => {
    const highP = evidenceConfidence(20, 0.5);
    const lowP = evidenceConfidence(20, 0.001);
    expect(lowP).toBeGreaterThan(highP);
  });

  it("reflects sample size", () => {
    const small = evidenceConfidence(5, null);
    const large = evidenceConfidence(50, null);
    expect(large).toBeGreaterThan(small);
  });
});

// ═══════════════ DATA SUFFICIENCY ═══════════════

describe("Data sufficiency enforcement", () => {
  it("rejects insufficient data", () => {
    expect(checkSufficiency(3, "correlation").sufficient).toBe(false);
    expect(checkSufficiency(2, "trend").sufficient).toBe(false);
    expect(checkSufficiency(5, "driver").sufficient).toBe(false);
  });

  it("accepts sufficient data", () => {
    expect(checkSufficiency(10, "correlation").sufficient).toBe(true);
    expect(checkSufficiency(8, "driver").sufficient).toBe(true);
  });
});

// ═══════════════ FULL PIPELINE ═══════════════

describe("Full analysis pipeline", () => {
  it("produces findings with explainability metadata", () => {
    const metrics = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      metric_type: "engagement",
      value: i < 10 ? 50 + Math.random() * 5 : 80 + Math.random() * 5,
      date: `2026-${String(i + 1).padStart(2, "0")}-01`,
      region: null,
      segment: i % 2 === 0 ? "A" : "B",
    }));

    const findings = runFullAnalysis(metrics, "test-ds-123");
    expect(findings.length).toBeGreaterThan(0);

    // Every finding must have explainability
    findings.forEach(f => {
      expect(f.explain.method).toBeTruthy();
      expect(f.explain.sampleSize).toBeGreaterThan(0);
      expect(f.explain.variables.length).toBeGreaterThan(0);
      expect(f.explain.assumptions.length).toBeGreaterThan(0);
      expect(f.explain.limitations.length).toBeGreaterThan(0);
      expect(f.decisionRelevance).toBeTruthy();
      expect(f.observation).toBeTruthy();
      expect(f.inference).toBeTruthy();
    });
  });

  it("returns empty for no data", () => {
    expect(runFullAnalysis([])).toHaveLength(0);
  });
});

// ═══════════════ ANALYST NOTE GENERATOR ═══════════════

describe("Analyst note generator", () => {
  it("generates readable summary from findings", () => {
    const metrics = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      metric_type: "performance",
      value: i < 10 ? 50 : 80,
      date: `2026-${String(i + 1).padStart(2, "0")}-01`,
      region: null,
      segment: i % 2 === 0 ? "GroupA" : "GroupB",
    }));
    const findings = runFullAnalysis(metrics);
    const note = generateAnalystNote(findings);
    expect(note).toContain("Analyst Summary");
    expect(note.length).toBeGreaterThan(50);
  });

  it("returns fallback for empty findings", () => {
    const note = generateAnalystNote([]);
    expect(note).toContain("Insufficient data");
  });
});
