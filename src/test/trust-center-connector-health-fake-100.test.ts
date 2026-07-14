import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Trust Center connector_health_pct (audit: '100%' not reflecting AICIS outage)", () => {
  // Nothing in the codebase ever inserted into connector_health_snapshots
  // (grep across supabase/functions found zero writers), so the query
  // always returned an empty result set and connector_health_pct silently
  // kept its hardcoded 100 default -- a real AICIS outage that set
  // external_data_sources.last_error never moved this number. Switched to
  // reading external_data_sources.last_error, which sync-aicis-bridge and
  // other connector pipelines actually write to on failure.
  const source = read("supabase/functions/compute-trust-metrics/index.ts");

  it("no longer reads from the never-populated connector_health_snapshots table", () => {
    expect(source).not.toContain('svc.from("connector_health_snapshots")');
  });

  it("derives connector_health_pct from external_data_sources.last_error", () => {
    expect(source).toContain('svc.from("external_data_sources").select("last_error")');
    expect(source).toContain("eds.filter((r: any) => !r.last_error)");
    expect(source).toContain('source_tables: ["external_data_sources"]');
  });
});
