import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Round 4 GA/pilot-readiness audit batch", () => {
  describe("/demo no longer fires a false 'Your session ended' toast during provisioning", () => {
    const source = read("src/pages/Demo.tsx");

    it("uses AuthContext's signOut() instead of the raw supabase client", () => {
      // supabase.auth.signOut() bypasses AuthContext's deliberateSignOutRef,
      // so the onAuthStateChange listener treated every demo launch as an
      // *unexpected* sign-out and fired "Your session ended, please sign in
      // again" while the provisioning progress bar was still running.
      expect(source).toContain("const { signOut } = useAuth();");
      expect(source).toContain("await signOut();");
      expect(source).not.toContain("await supabase.auth.signOut();");
    });
  });

  describe("/compliance no longer login-walls anonymous procurement visitors", () => {
    const source = read("src/components/auth/ProtectedRoute.tsx");

    it("redirects a logged-out visit to /compliance to the public Trust Center instead of /login", () => {
      expect(source).toContain('"/compliance": "/trust"');
      expect(source).toContain("LOGGED_OUT_REDIRECT_OVERRIDES[location.pathname]");
    });
  });

  describe("Decision detail no longer renders 'Not available probability of positive ROI'", () => {
    const source = read("src/components/decisions/ExecutiveDecisionReview.tsx");

    it("uses a phrase builder that doesn't concatenate the fallback with the suffix", () => {
      expect(source).toContain('pctPhrase(decision.predicted_roi_probability, "probability of positive ROI")');
      expect(source).not.toContain("{pct(decision.predicted_roi_probability)} probability of positive ROI");
    });
  });

  describe("Advisory-sourced decisions no longer get a fabricated tiny euro impact", () => {
    const autoCreate = read("supabase/functions/auto-create-decisions/index.ts");
    const supplierRisk = read("supabase/functions/supplier-risk-runtime-ingest/index.ts");
    const shared = read("supabase/functions/_shared/impact-estimate.ts");

    it("both edge functions import the shared parser instead of duplicating a naive digit-averaging one", () => {
      expect(autoCreate).toContain('import { parseImpactEstimate } from "../_shared/impact-estimate.ts";');
      expect(supplierRisk).toContain('import { parseImpactEstimate } from "../_shared/impact-estimate.ts";');
      expect(autoCreate).not.toContain("text.match(/-?\\d+(?:[,.]\\d+)?/g)");
      expect(supplierRisk).not.toContain("text.match(/-?\\d+(?:[,.]\\d+)?/g)");
    });

    it("the shared parser only trusts currency-marked figures", () => {
      expect(shared).toContain("[€$£]");
    });
  });
});
