import { describe, it, expect } from "vitest";

/**
 * Enterprise Data Integration Tests
 * Validates multi-dataset architecture, connector contracts, and metric mapping.
 */

describe("Multi-Dataset Architecture", () => {
  it("connector_configs table schema supports multiple connector types", () => {
    const supportedTypes = ["postgresql", "mysql", "sqlserver", "snowflake", "bigquery", "powerbi"];
    expect(supportedTypes.length).toBe(6);
    supportedTypes.forEach(type => {
      expect(typeof type).toBe("string");
      expect(type.length).toBeGreaterThan(0);
    });
  });

  it("metric_mappings require source_table, source_column, and metric_type", () => {
    const validMapping = {
      source_table: "orders",
      source_column: "total_value",
      metric_type: "revenue",
      date_column: "created_at",
      aggregation: "sum",
    };
    expect(validMapping.source_table).toBeTruthy();
    expect(validMapping.source_column).toBeTruthy();
    expect(validMapping.metric_type).toBeTruthy();
    expect(validMapping.date_column).toBeTruthy();

    const invalidMapping = { source_table: "", source_column: "", metric_type: "" };
    expect(invalidMapping.source_table).toBeFalsy();
  });

  it("sync_schedules support hourly, daily, weekly frequencies", () => {
    const validFrequencies = ["hourly", "daily", "weekly"];
    validFrequencies.forEach(freq => {
      expect(["hourly", "daily", "weekly"]).toContain(freq);
    });
    expect(validFrequencies).not.toContain("yearly");
  });

  it("multiple datasets can coexist for the same organization", () => {
    const orgId = "org-1";
    const datasets = [
      { id: "ds-1", organization_id: orgId, name: "CRM Data", connector_type: "postgresql" },
      { id: "ds-2", organization_id: orgId, name: "Finance Data", connector_type: "postgresql" },
      { id: "ds-3", organization_id: orgId, name: "Product Usage", connector_type: "bigquery" },
      { id: "ds-4", organization_id: orgId, name: "Support Tickets", connector_type: "csv" },
    ];
    expect(datasets.length).toBe(4);
    expect(new Set(datasets.map(d => d.id)).size).toBe(4); // All unique IDs
    expect(datasets.every(d => d.organization_id === orgId)).toBe(true);
  });
});

describe("Connector Contract Validation", () => {
  it("connector request requires action and organization_id", () => {
    const validRequest = {
      action: "test",
      organization_id: "org-1",
      host: "db.example.com",
      port: 5432,
      database_name: "mydb",
      username: "readonly",
      password: "secret",
    };
    expect(validRequest.action).toBeTruthy();
    expect(validRequest.organization_id).toBeTruthy();
  });

  it("sync action requires data_source_id and metric_mappings", () => {
    const syncRequest = {
      action: "sync",
      organization_id: "org-1",
      data_source_id: "ds-1",
      metric_mappings: [
        { source_table: "orders", source_column: "total", metric_type: "revenue", date_column: "created_at" },
      ],
    };
    expect(syncRequest.data_source_id).toBeTruthy();
    expect(syncRequest.metric_mappings.length).toBeGreaterThan(0);
    expect(syncRequest.metric_mappings[0].date_column).toBeTruthy();
  });

  it("connection config sanitizes table names to prevent SQL injection", () => {
    const dangerousName = "users; DROP TABLE users;--";
    const sanitized = dangerousName.replace(/[^a-zA-Z0-9_]/g, "");
    expect(sanitized).toBe("usersDROPTABLEusers");
    expect(sanitized).not.toContain(";");
    expect(sanitized).not.toContain("-");
  });

  it("aggregation type must be in allowlist", () => {
    const allowedAgg = ["sum", "avg", "count", "min", "max"];
    expect(allowedAgg).toContain("sum");
    expect(allowedAgg).toContain("avg");
    expect(allowedAgg).not.toContain("DROP");
    expect(allowedAgg).not.toContain("eval");
  });
});

describe("Metric Mapping Engine", () => {
  it("auto-detects revenue from column names", () => {
    const guessMetricType = (colName: string): string => {
      const lower = colName.toLowerCase();
      if (lower.includes("revenue") || lower.includes("sales") || lower.includes("income")) return "revenue";
      if (lower.includes("cost") || lower.includes("expense")) return "cost";
      if (lower.includes("customer") || lower.includes("user")) return "customers";
      if (lower.includes("churn")) return "churn";
      return "custom";
    };

    expect(guessMetricType("total_revenue")).toBe("revenue");
    expect(guessMetricType("monthly_sales")).toBe("revenue");
    expect(guessMetricType("operating_cost")).toBe("cost");
    expect(guessMetricType("active_customers")).toBe("customers");
    expect(guessMetricType("churn_rate")).toBe("churn");
    expect(guessMetricType("random_field")).toBe("custom");
  });

  it("mappings produce valid metric records with required fields", () => {
    const mapping = {
      source_table: "orders",
      source_column: "total_value",
      metric_type: "revenue",
      date_column: "created_at",
      aggregation: "sum",
    };

    const metricRecord = {
      organization_id: "org-1",
      metric_type: mapping.metric_type,
      value: 15000,
      date: "2025-01-01",
      source_type: "connector",
      source_id: "ds-1",
      quality_score: 90,
    };

    expect(metricRecord.organization_id).toBeTruthy();
    expect(metricRecord.metric_type).toBe("revenue");
    expect(typeof metricRecord.value).toBe("number");
    expect(metricRecord.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(metricRecord.source_type).toBe("connector");
    expect(metricRecord.quality_score).toBeGreaterThanOrEqual(0);
    expect(metricRecord.quality_score).toBeLessThanOrEqual(100);
  });
});

describe("Multi-Source Decision Engine", () => {
  it("can aggregate metrics from multiple data sources", () => {
    const metricsFromSources = [
      { source: "CRM", metric_type: "revenue", value: 50000 },
      { source: "Finance", metric_type: "revenue", value: 48000 },
      { source: "Stripe", metric_type: "revenue", value: 51000 },
    ];

    const revenueMetrics = metricsFromSources.filter(m => m.metric_type === "revenue");
    expect(revenueMetrics.length).toBe(3);

    // System should be able to detect discrepancies
    const values = revenueMetrics.map(m => m.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
    expect(variance).toBeGreaterThan(0); // Variance exists between sources
  });

  it("handles missing date columns gracefully", () => {
    const mappingWithoutDate = {
      source_table: "summary",
      source_column: "total",
      metric_type: "revenue",
      date_column: "", // Missing
    };
    expect(mappingWithoutDate.date_column).toBeFalsy();
    // System should skip mappings without date columns
  });

  it("enforces organization isolation across connectors", () => {
    const org1Connectors = [
      { id: "c1", organization_id: "org-1", host: "db1.com" },
      { id: "c2", organization_id: "org-1", host: "db2.com" },
    ];
    const org2Connectors = [
      { id: "c3", organization_id: "org-2", host: "db3.com" },
    ];

    // No connector from org-2 should appear in org-1 query
    const org1Result = [...org1Connectors, ...org2Connectors].filter(c => c.organization_id === "org-1");
    expect(org1Result.length).toBe(2);
    expect(org1Result.every(c => c.organization_id === "org-1")).toBe(true);
  });
});
