import { describe, it, expect } from "vitest";

/**
 * Accessibility contract tests — verify key WCAG 2.1 AA requirements
 * are maintained in the codebase.
 */

describe("Accessibility Standards", () => {
  it("ProtectedShell has skip-to-content link", async () => {
    const mod = await import("fs");
    const content = mod.readFileSync("src/components/layout/ProtectedShell.tsx", "utf-8");
    expect(content).toContain('href="#main-content"');
    expect(content).toContain("Skip to main content");
    expect(content).toContain("sr-only");
  });

  it("ProtectedShell wraps children in <main> landmark", async () => {
    const mod = await import("fs");
    const content = mod.readFileSync("src/components/layout/ProtectedShell.tsx", "utf-8");
    expect(content).toContain('id="main-content"');
    expect(content).toContain('role="main"');
  });

  it("Dashboard relies on the protected shell for its single main landmark", async () => {
    const mod = await import("fs");
    const content = mod.readFileSync("src/pages/Dashboard.tsx", "utf-8");
    expect(content).not.toContain('<main id="main-content"');
  });

  it("DashboardSidebar has navigation landmark", async () => {
    const mod = await import("fs");
    const content = mod.readFileSync("src/components/dashboard/DashboardSidebar.tsx", "utf-8");
    expect(content).toContain('aria-label');
    expect(content).toContain("<nav");
  });

  it("SystemHealthDashboard uses section landmark", async () => {
    const mod = await import("fs");
    const content = mod.readFileSync("src/components/dashboard/SystemHealthDashboard.tsx", "utf-8");
    expect(content).toContain('aria-label="System Intelligence Dashboard"');
    expect(content).toContain("<section");
  });

  it("CommandCenter uses section landmark", async () => {
    const mod = await import("fs");
    const content = mod.readFileSync("src/components/dashboard/CommandCenter.tsx", "utf-8");
    expect(content).toContain('aria-label="Command Center Dashboard"');
    expect(content).toContain("<section");
  });

  it("Analytics toggle has aria-expanded", async () => {
    const mod = await import("fs");
    const content = mod.readFileSync("src/components/dashboard/CommandCenter.tsx", "utf-8");
    expect(content).toContain("aria-expanded");
    expect(content).toContain("aria-controls");
  });
});
