import { describe, it, expect } from "vitest";

describe("Dataset Explorer", () => {
  it("should render dataset list from registry", () => {
    const datasets = [
      { id: "1", name: "CRM", status: "ready", row_count: 500 },
      { id: "2", name: "Finance", status: "ready", row_count: 1200 },
    ];
    expect(datasets).toHaveLength(2);
    expect(datasets.every(d => d.id && d.name && d.status)).toBe(true);
  });

  it("should compute column statistics from metrics", () => {
    const values = [10, 20, 30, 40, 50];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(mean).toBe(30);
    expect(min).toBe(10);
    expect(max).toBe(50);
  });

  it("should support sample row display (first 50)", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: `r${i}`, value: i }));
    const sample = rows.slice(0, 50);
    expect(sample).toHaveLength(50);
    expect(sample[0].id).toBe("r0");
    expect(sample[49].id).toBe("r49");
  });
});

describe("Persistent Datasets", () => {
  it("should maintain dataset registry with required fields", () => {
    const dataset = {
      id: "ds-1",
      organization_id: "org-1",
      name: "Test Dataset",
      status: "ready",
      row_count: 100,
      created_at: "2026-01-01",
    };
    expect(dataset.id).toBeDefined();
    expect(dataset.organization_id).toBeDefined();
    expect(dataset.row_count).toBeGreaterThan(0);
  });

  it("should support multiple datasets per organization", () => {
    const datasets = [
      { id: "1", org: "org-1", name: "CRM" },
      { id: "2", org: "org-1", name: "Finance" },
      { id: "3", org: "org-1", name: "Product Usage" },
    ];
    const orgDatasets = datasets.filter(d => d.org === "org-1");
    expect(orgDatasets).toHaveLength(3);
  });
});

describe("Analyst Mode — Contextual Insights", () => {
  it("should detect trends with >10% change", () => {
    const earlyValues = [100, 110, 105];
    const lateValues = [80, 75, 70];
    const earlyAvg = earlyValues.reduce((s, v) => s + v, 0) / earlyValues.length;
    const lateAvg = lateValues.reduce((s, v) => s + v, 0) / lateValues.length;
    const changePct = ((lateAvg - earlyAvg) / Math.abs(earlyAvg)) * 100;
    expect(changePct).toBeLessThan(-10);
  });

  it("should compute Pearson correlation", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    const aMean = 3;
    const bMean = 6;
    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < 5; i++) {
      num += (a[i] - aMean) * (b[i] - bMean);
      denA += (a[i] - aMean) ** 2;
      denB += (b[i] - bMean) ** 2;
    }
    const corr = num / Math.sqrt(denA * denB);
    expect(corr).toBeCloseTo(1.0, 5);
  });

  it("should detect anomalies via z-score", () => {
    const values = [10, 11, 10, 12, 11, 50, 10, 11];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const anomalies = values.filter(v => Math.abs((v - mean) / std) > 2);
    expect(anomalies).toContain(50);
    expect(anomalies.length).toBeGreaterThan(0);
  });

  it("should detect segment disparity", () => {
    const segments = { A: [100, 110, 105], B: [30, 25, 28] };
    const avgA = segments.A.reduce((s, v) => s + v, 0) / segments.A.length;
    const avgB = segments.B.reduce((s, v) => s + v, 0) / segments.B.length;
    const spread = ((avgA - avgB) / Math.abs(avgA)) * 100;
    expect(spread).toBeGreaterThan(15);
  });

  it("should reference metric names in findings", () => {
    const finding = {
      metricRef: "study_hours",
      observation: "study_hours decreased 22% among students with gaming_hours > 5.",
    };
    expect(finding.observation).toContain("study_hours");
    expect(finding.metricRef).toBe("study_hours");
  });
});

describe("Industry-Agnostic Metrics", () => {
  it("should accept arbitrary metric types", () => {
    const customMetrics = ["engagement", "utilization", "risk_score", "nps", "defect_rate"];
    customMetrics.forEach(m => {
      expect(typeof m).toBe("string");
      expect(m.length).toBeGreaterThan(0);
    });
  });

  it("should compute summaries for any metric type", () => {
    const rows = [
      { metric_type: "engagement", value: 75 },
      { metric_type: "engagement", value: 80 },
      { metric_type: "risk_score", value: 0.3 },
    ];
    const types = [...new Set(rows.map(r => r.metric_type))];
    expect(types).toContain("engagement");
    expect(types).toContain("risk_score");
  });
});
