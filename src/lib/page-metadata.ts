export interface PageMetadataDefinition {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: "index, follow" | "noindex, nofollow";
  type?: "website" | "article";
}

export const PAGE_METADATA: Record<string, PageMetadataDefinition> = {
  "/trust": {
    title: "Trust Center | Quantivis",
    description:
      "Review Quantivis security controls, certification roadmap, compliance evidence, data residency, and procurement resources.",
    canonicalPath: "/trust",
  },
  "/security": {
    title: "Enterprise Security | Quantivis",
    description:
      "Explore Quantivis authentication, encryption, tenant isolation, audit logging, incident response, and enterprise security controls.",
    canonicalPath: "/security",
  },
  "/how-ai-is-used": {
    title: "How Quantivis Uses AI | Quantivis",
    description:
      "See where deterministic systems, statistical models, generative AI, human approval, and logged automation operate in Quantivis.",
    canonicalPath: "/how-ai-is-used",
  },
  "/ai-system-classification": {
    title: "EU AI Act System Classification | Quantivis",
    description:
      "Review the Quantivis capability-by-capability EU AI Act classification, oversight, explainability, logging, and data-governance matrix.",
    canonicalPath: "/ai-system-classification",
  },
  "/impressum": {
    title: "Impressum | Quantivis Global",
    description:
      "Legal provider information, company contacts, responsible representatives, and regulatory disclosures for Quantivis Global.",
    canonicalPath: "/impressum",
  },
  "/pricing": {
    title: "Pricing for Enterprise AI Decision Governance | Quantivis",
    description:
      "Compare Quantivis plans for governed AI decisions, audit trails, human oversight, simulations, and enterprise procurement requirements.",
    canonicalPath: "/pricing",
  },
  "/compare": {
    title: "Compare Decision Governance Capabilities | Quantivis",
    description:
      "Compare governed decision workflows, evidence trails, confidence controls, and enterprise capabilities in Quantivis.",
    canonicalPath: "/compare",
    robots: "noindex, nofollow",
  },
  "/copilot": {
    title: "Governed Executive Copilot | Quantivis",
    description:
      "Use the Quantivis executive copilot to query governed evidence, decision history, and operational intelligence.",
    canonicalPath: "/copilot",
    robots: "noindex, nofollow",
  },
  "/embed": {
    title: "Embedded Decision Governance | Quantivis",
    description:
      "Token-authenticated Quantivis embedded decision-governance surface.",
    canonicalPath: "/embed",
    robots: "noindex, nofollow",
  },
  "/decision-intelligence-platforms": {
    title: "Decision Intelligence Platforms in 2026 — Compared | Quantivis",
    description:
      "Compare 11 decision intelligence platforms across closed-loop coverage, governance, and epistemic integrity.",
    canonicalPath: "/decision-intelligence-platforms",
    type: "article",
  },
};

export const metadataForPath = (
  pathname: string,
): PageMetadataDefinition | undefined => PAGE_METADATA[pathname];
