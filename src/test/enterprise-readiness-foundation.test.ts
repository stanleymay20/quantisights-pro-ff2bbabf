import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

  it("uses evidence-safe authentication claims", () => {
    const authLayout = read("src/components/auth/AuthLayout.tsx");

    expect(authLayout).not.toContain("SOC 2 Type II controls");
    expect(authLayout).not.toContain("Enterprise SSO · SCIM · MFA");
    expect(authLayout).toContain(
      "Controls aligned to SOC 2; independent audit in progress",
    );
    expect(authLayout).toContain(
      "Enterprise SSO, SCIM, and MFA available when configured",
    );
  });

  it("treats missing operational evidence as unknown", async () => {
    const statusPath = resolve(root, "src/lib/system-status.ts");
    const exists = existsSync(statusPath);
    expect(exists).toBe(true);
    if (!exists) return;

    const moduleUrl = pathToFileURL(statusPath).href;
    const { deriveSystemStatus } = await import(/* @vite-ignore */ moduleUrl);

    expect(
      deriveSystemStatus({
        queriesSucceeded: true,
        recordedRuns: 0,
        criticalFailures: 0,
        nonCriticalFailures: 0,
      }),
    ).toBe("unknown");
    expect(
      deriveSystemStatus({
        queriesSucceeded: false,
        recordedRuns: 10,
        criticalFailures: 0,
        nonCriticalFailures: 0,
      }),
    ).toBe("unknown");
    expect(
      deriveSystemStatus({
        queriesSucceeded: true,
        recordedRuns: 10,
        criticalFailures: 0,
        nonCriticalFailures: 0,
      }),
    ).toBe("operational");
  });

  it("keeps public certification and authentication claims conditional", () => {
    const publicClaims = [
      read("index.html"),
      read("src/pages/Index.tsx"),
      read("src/pages/Pricing.tsx"),
      read("src/pages/SLA.tsx"),
      read("src/pages/SecurityQuestionnaire.tsx"),
      read("src/pages/TrustCenter.tsx"),
      read("src/lib/copilot-answer-engine.ts"),
    ].join("\n");

    expect(publicClaims).not.toContain("Quantivis guarantees 99.9% monthly uptime");
    expect(publicClaims).not.toContain('"99.9% SLA"');
    expect(publicClaims).not.toContain(
      "MFA is enforced at the route level using AAL2",
    );
    expect(publicClaims).not.toContain(
      "All subprocessors (Supabase, Cloudflare, PostHog EU, Sentry) are SOC 2 Type II certified",
    );
    expect(publicClaims).not.toContain(
      "Compliance coverage includes SOC 2, ISO 27001, EU AI Act, and GDPR",
    );

    expect(publicClaims).toContain("available when configured");
    expect(publicClaims).toContain("contractually committed");
    expect(publicClaims).toContain("Quantivis entity audit");
  });

  it("exposes diligence-grade procurement evidence fields", () => {
    const checklist = read(
      "src/components/security/ProcurementReadinessChecklist.tsx",
    );

    for (const field of [
      "source",
      "method",
      "scope",
      "owner",
      "freshness",
    ]) {
      expect(checklist).toContain(field);
    }
    expect(checklist).toContain("Evidence unavailable");
    expect(checklist).toContain("Verification overdue");
  });

  it("exposes buyer-safe public integrations, copilot, and comparison routes", () => {
    const routes = read("src/routes/index.tsx");
    expect(routes).toContain('path: "/integrations"');
    expect(routes).toContain('{ path: "/copilot", element: <CopilotOverview />, layout: "public" }');
    expect(routes).toContain('{ path: "/compare", element: <Compare />, layout: "public" }');
  });

  it("initializes both observability clients from the application entrypoint", () => {
    const main = read("src/main.tsx");
    expect(main).toContain('import "@/lib/analytics"');
    expect(main).toContain("recordObservabilityStartup");
  });

  it("uses sanitized scheduler evidence and degrades stale critical jobs", () => {
    const statusPage = read("src/pages/SystemStatus.tsx");
    const statusLogic = read("src/lib/system-status.ts");
    expect(statusPage).toContain('functions.invoke<PublicStatusResponse>("public-system-status")');
    expect(statusLogic).toContain("staleCriticalJobs");
    expect(statusLogic).toContain('return "degraded"');
  });

  it("removes unsupported absolutes from the public trust surface", () => {
    const trust = read("src/pages/TrustCenter.tsx");
    const evidence = read("src/components/security/AttestedEvidence.tsx");
    for (const unsupported of [
      "Your data never leaves the EU",
      "keeps your AI decisions on-premises",
      "7 autonomous orchestration jobs",
      'value: "100%"',
      "Sub-processors with signed DPA",
    ]) {
      expect(`${trust}\n${evidence}`).not.toContain(unsupported);
    }
  });

});
