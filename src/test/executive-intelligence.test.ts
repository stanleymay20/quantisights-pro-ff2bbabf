import { describe, it, expect } from "vitest";
import {
  computeStrategicHealth,
  aggregateRiskSignals,
  generateForecast,
  generateExecutiveSummary,
  computePerformanceDrivers,
} from "@/lib/executive-intelligence";
import type { MetricRow } from "@/hooks/useMetrics";

function makeMetrics(type: string, values: number[], segment?: string): MetricRow[] {
  return values.map((v, i) => ({
    id: `${type}-${i}`,
    metric_type: type,
    value: v,
    date: `2026-${String(i + 1).padStart(2, "0")}-01`,
    region: null,
    segment: segment || null,
  }));
}

// ═══════════════ STRATEGIC HEALTH ═══════════════

describe("Strategic Health Score", () => {
  it("computes health from real metrics", () => {
    const metrics = [
      ...makeMetrics("revenue", [100, 110, 120, 130, 140, 150]),
      ...makeMetrics("engagement", [50, 52, 48, 55, 60, 65]),
    ];
    const health = computeStrategicHealth(metrics);
    expect(health).not.toBeNull();
    expect(health!.overallScore).toBeGreaterThan(0);
    expect(health!.overallScore).toBeLessThanOrEqual(100);
    expect(health!.dataPoints).toBe(12);
  });

  it("returns null for insufficient data", () => {
    expect(computeStrategicHealth(makeMetrics("x", [1, 2, 3]))).toBeNull();
  });

  it("detects positive growth momentum", () => {
    const metrics = makeMetrics("revenue", [10, 12, 14, 16, 20, 25, 30, 40]);
    const health = computeStrategicHealth(metrics);
    expect(health).not.toBeNull();
    expect(health!.growthMomentum).toBeGreaterThan(0);
  });

  it("detects negative growth momentum", () => {
    const metrics = makeMetrics("revenue", [100, 90, 80, 70, 50, 40, 30, 20]);
    const health = computeStrategicHealth(metrics);
    expect(health).not.toBeNull();
    expect(health!.growthMomentum).toBeLessThan(0);
  });

  it("never fabricates health scores", () => {
    const metrics = makeMetrics("x", [50, 50, 50, 50, 50, 50]);
    const health = computeStrategicHealth(metrics);
    // With flat data: no growth trend detected, score purely from stability + data coverage
    if (health) {
      expect(health.overallScore).toBeGreaterThanOrEqual(0);
      expect(health.overallScore).toBeLessThanOrEqual(100);
      expect(health.growthMomentum).toBe(0); // Flat, no fabricated growth
    }
  });
});

// ═══════════════ RISK RADAR ═══════════════

describe("Risk Radar", () => {
  it("detects volatility risk", () => {
    const metrics = makeMetrics("revenue", [100, 50, 120, 30, 110, 40, 90, 60]);
    const risks = aggregateRiskSignals(metrics);
    expect(risks.some(r => r.category === "volatility")).toBe(true);
  });

  it("detects decline risk", () => {
    const metrics = makeMetrics("customers", [100, 90, 80, 70, 50, 40, 30, 20]);
    const risks = aggregateRiskSignals(metrics);
    expect(risks.some(r => r.category === "decline")).toBe(true);
  });

  it("returns empty for stable data", () => {
    const metrics = makeMetrics("x", [100, 101, 99, 100, 101, 99, 100, 101]);
    const risks = aggregateRiskSignals(metrics);
    const highRisks = risks.filter(r => r.level === "high");
    expect(highRisks).toHaveLength(0);
  });

  it("returns empty for insufficient data", () => {
    expect(aggregateRiskSignals(makeMetrics("x", [1, 2]))).toHaveLength(0);
  });
});

// ═══════════════ FORECAST ═══════════════

describe("Forecast projection", () => {
  it("generates forecast with sufficient data", () => {
    const vals = [10, 12, 14, 16, 18, 20, 22, 24];
    const forecast = generateForecast(vals, "revenue");
    expect(forecast).not.toBeNull();
    expect(forecast!.baseline.values.length).toBe(3);
    expect(forecast!.upside.values[0]).toBeGreaterThan(forecast!.baseline.values[0]);
    expect(forecast!.downside.values[0]).toBeLessThan(forecast!.baseline.values[0]);
  });

  it("returns null for insufficient data", () => {
    expect(generateForecast([1, 2, 3], "x")).toBeNull();
    expect(generateForecast([1, 2, 3, 4, 5], "x")).toBeNull();
  });

  it("includes sampleSize and confidence", () => {
    const forecast = generateForecast([10, 20, 30, 40, 50, 60], "metric");
    expect(forecast).not.toBeNull();
    expect(forecast!.sampleSize).toBe(6);
    expect(forecast!.confidence).toBeGreaterThan(0);
    expect(forecast!.confidence).toBeLessThanOrEqual(90);
  });

  it("projects upward trend forward", () => {
    const vals = [10, 20, 30, 40, 50, 60];
    const forecast = generateForecast(vals, "growth");
    expect(forecast!.baseline.values[0]).toBeGreaterThan(60);
  });
});

// ═══════════════ PERFORMANCE DRIVERS ═══════════════

describe("Performance drivers", () => {
  it("identifies primary driver", () => {
    const metrics = [
      ...makeMetrics("leads", [100, 100, 100, 100, 80, 75, 70, 65]),
      ...makeMetrics("conversion", [10, 10, 10, 10, 9, 9, 9, 9]),
    ];
    const drivers = computePerformanceDrivers(metrics);
    expect(drivers).not.toBeNull();
    expect(drivers![0].metric).toBe("leads");
    expect(drivers![0].contribution).toBeGreaterThan(50);
  });

  it("returns null for insufficient data", () => {
    expect(computePerformanceDrivers(makeMetrics("x", [1, 2, 3]))).toBeNull();
  });
});

// ═══════════════ EXECUTIVE SUMMARY ═══════════════

describe("Executive summary generator", () => {
  it("generates summary from real data", () => {
    const metrics = [
      ...makeMetrics("revenue", [100, 110, 120, 130, 140, 150, 160, 170]),
      ...makeMetrics("churn", [5, 5, 6, 7, 8, 9, 10, 11]),
    ];
    const health = computeStrategicHealth(metrics);
    const risks = aggregateRiskSignals(metrics);
    const drivers = computePerformanceDrivers(metrics);
    const summary = generateExecutiveSummary(health, risks, drivers, 3, "Q1 Analysis");
    expect(summary).toContain("Q1 Analysis");
    expect(summary.length).toBeGreaterThan(20);
  });

  it("returns insufficient message for no data", () => {
    const summary = generateExecutiveSummary(null, [], null, 0);
    expect(summary).toContain("Insufficient data");
  });

  it("references pending decisions", () => {
    const health = computeStrategicHealth(makeMetrics("x", [10, 20, 30, 40, 50, 60]));
    const summary = generateExecutiveSummary(health, [], null, 5);
    expect(summary).toContain("5");
    expect(summary).toContain("decision");
  });
});

// ═══════════════ NO FABRICATION ═══════════════

describe("Data integrity rules", () => {
  it("health score uses only real metric values", () => {
    const metrics = makeMetrics("test", [42, 43, 44, 45, 46, 47]);
    const health = computeStrategicHealth(metrics);
    expect(health).not.toBeNull();
    // Components should reference actual data
    expect(health!.dataPoints).toBe(6);
  });

  it("forecast requires valid historical data", () => {
    expect(generateForecast([], "x")).toBeNull();
    expect(generateForecast([1], "x")).toBeNull();
  });

  it("risk radar never generates risks from insufficient data", () => {
    expect(aggregateRiskSignals([])).toHaveLength(0);
    expect(aggregateRiskSignals(makeMetrics("x", [1]))).toHaveLength(0);
  });
});
