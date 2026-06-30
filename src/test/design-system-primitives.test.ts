import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DS-2 shared design primitives", () => {
  it("defines the low-risk shared marketing primitives", () => {
    const primitivePath = "src/components/design-system/marketing-primitives.tsx";

    expect(existsSync(resolve(root, primitivePath))).toBe(true);

    const primitives = read(primitivePath);
    for (const exportName of [
      "Eyebrow",
      "MarketingCard",
      "MarketingSection",
      "TagBadge",
      "MarketingCTA",
    ]) {
      expect(primitives).toContain(`export const ${exportName}`);
    }

    expect(primitives).toContain("hsl(var(--brand-marketing-slate))");
    expect(primitives).toContain("hsl(var(--surface-marketing))");
    expect(primitives).toContain("hsl(var(--status-success))");
    expect(primitives).toContain("hsl(var(--decision-needs-review))");
  });

  it("uses DS-1 semantic tokens for homepage tag badges instead of TAG_STYLES", () => {
    const homepage = read("src/pages/Index.tsx");

    expect(homepage).not.toContain("const TAG_STYLES");
    expect(homepage).toContain('import { Eyebrow, MarketingCard, MarketingCTA, MarketingSection, TagBadge }');
    expect(homepage).toContain('<TagBadge tone={primaryDecision.tag}');
    expect(homepage).toContain('<TagBadge tone={decision.tag}');
    expect(homepage).not.toContain("Approved: { bg:");
    expect(homepage).not.toContain("Pending: { bg:");
    expect(homepage).not.toContain("Review: { bg:");
  });

  it("documents DS-2 as a primitive layer without claiming full page migration", () => {
    const readme = read("src/design-system/README.md");

    expect(readme).toContain("DS-2 shared primitives");
    expect(readme).toContain("Eyebrow");
    expect(readme).toContain("MarketingCard");
    expect(readme).toContain("MarketingSection");
    expect(readme).toContain("TagBadge");
    expect(readme).toContain("MarketingCTA");
    expect(readme).toContain("DS-2 does not migrate full pages");
  });
});
