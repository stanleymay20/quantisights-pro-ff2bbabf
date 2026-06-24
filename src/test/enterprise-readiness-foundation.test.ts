import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("enterprise readiness foundation", () => {
  it("defines centralized metadata for every audited route", () => {
    const metadataPath = resolve(root, "src/lib/page-metadata.ts");
    expect(existsSync(metadataPath)).toBe(true);

    const metadata = readFileSync(metadataPath, "utf8");
    const auditedRoutes = [
      "/trust",
      "/security",
      "/how-ai-is-used",
      "/ai-system-classification",
      "/impressum",
      "/pricing",
      "/compare",
      "/copilot",
      "/embed",
      "/decision-intelligence-platforms",
    ];

    for (const route of auditedRoutes) {
      expect(metadata).toContain(`"${route}"`);
    }
  });

  it("serves the trust center at /trust and redirects the legacy route", () => {
    const routes = read("src/routes/index.tsx");

    expect(routes).toContain('{ path: "/trust", element: <TrustCenter />, layout: "public" }');
    expect(routes).toContain(
      '{ path: "/trust-center", element: <Navigate to="/trust" replace />, layout: "none" }',
    );
  });

  it("does not deliver CSP through a meta element", () => {
    expect(read("index.html")).not.toMatch(
      /http-equiv=["']Content-Security-Policy["']/i,
    );
  });

  it("allows configured observability endpoints and blob workers in every CSP", () => {
    const policies = [
      read("public/_headers"),
      read("public/_worker.js"),
      read("vercel.json"),
    ];

    for (const policy of policies) {
      expect(policy).toContain("eu-assets.i.posthog.com");
      expect(policy).toContain("eu.posthog.com");
      expect(policy).toContain("ingest.de.sentry.io");
      expect(policy).toContain("worker-src 'self' blob:");
    }
  });

  it("defines separate standard and embed framing policies", () => {
    const worker = read("public/_worker.js");

    expect(worker).toContain("frame-ancestors 'none'");
    expect(worker).toContain("EMBED_ALLOWED_ORIGINS");
    expect(worker).toMatch(/pathname.*\/embed/s);
  });
});
