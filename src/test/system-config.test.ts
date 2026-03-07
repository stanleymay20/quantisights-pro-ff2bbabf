import { describe, it, expect, beforeEach } from "vitest";
import { getSystemConfig, resetSystemConfig } from "@/lib/system-config";
import { validateSystemConfig } from "@/lib/validate-config";
import { computeCostOfDelay } from "@/lib/cost-of-delay";

beforeEach(() => {
  resetSystemConfig();
});

describe("System Configuration", () => {
  it("loads all configuration sections with defined values", () => {
    const cfg = getSystemConfig();
    expect(cfg.costOfDelay).toBeDefined();
    expect(cfg.decisionIntelligence).toBeDefined();
    expect(cfg.convergence).toBeDefined();
    expect(cfg.costOfDelay.severityWeights.critical).toBeGreaterThan(0);
    expect(cfg.decisionIntelligence.voi.uncertaintyReduction).toBeGreaterThan(0);
    expect(cfg.convergence.alignmentThresholds.aligned).toBeGreaterThan(0);
  });

  it("caches config after first call", () => {
    const a = getSystemConfig();
    const b = getSystemConfig();
    expect(a).toBe(b); // same reference
  });

  it("resets cache correctly", () => {
    const a = getSystemConfig();
    resetSystemConfig();
    const b = getSystemConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b); // same values though
  });
});

describe("Configuration Validation", () => {
  it("passes validation with default config", () => {
    const errors = validateSystemConfig();
    expect(errors).toHaveLength(0);
  });

  it("detects out-of-range severity weight", () => {
    const cfg = getSystemConfig();
    cfg.costOfDelay.severityWeights.critical = 200; // out of range
    const errors = validateSystemConfig(cfg);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === "VITE_COD_SEVERITY_CRITICAL")).toBe(true);
  });

  it("detects misordered label thresholds", () => {
    const cfg = getSystemConfig();
    cfg.costOfDelay.labelThresholds.critical = 30;
    cfg.costOfDelay.labelThresholds.high = 55; // higher than critical
    const errors = validateSystemConfig(cfg);
    expect(errors.some(e => e.field === "VITE_COD_LABEL_CRITICAL")).toBe(true);
  });

  it("detects misordered convergence alignment thresholds", () => {
    const cfg = getSystemConfig();
    cfg.convergence.alignmentThresholds.aligned = 50;
    cfg.convergence.alignmentThresholds.tension = 60; // higher than aligned
    const errors = validateSystemConfig(cfg);
    expect(errors.some(e => e.field === "VITE_CONV_ALIGNED")).toBe(true);
  });
});

describe("Cost of Delay uses config", () => {
  it("produces different scores for different severities", () => {
    const base = { confidence: 50, ageDays: 0 };
    const critical = computeCostOfDelay({ ...base, severity: "critical" });
    const low = computeCostOfDelay({ ...base, severity: "low" });
    expect(critical.score).toBeGreaterThan(low.score);
  });

  it("increases score with age", () => {
    const base = { severity: "medium" as const, confidence: 50 };
    const fresh = computeCostOfDelay({ ...base, ageDays: 0 });
    const old = computeCostOfDelay({ ...base, ageDays: 20 });
    expect(old.score).toBeGreaterThan(fresh.score);
  });

  it("returns valid labels", () => {
    const result = computeCostOfDelay({ severity: "high", confidence: 80 });
    expect(["low", "medium", "high", "critical"]).toContain(result.label);
  });

  it("clamps score to 0-100", () => {
    const result = computeCostOfDelay({
      severity: "critical",
      confidence: 100,
      signalDelta: 100,
      affectedEntityCount: 1000,
      trendAccelerating: true,
      ageDays: 100,
      affectedMetricType: "churn",
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
