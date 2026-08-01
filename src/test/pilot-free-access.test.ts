import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Pilot phase: users don't have to pay to use the product", () => {
  const migration = read("supabase/migrations/20260716120000_pilot_free_access.sql");

  it("grants every new signup a full-access subscription instead of leaving them with none", () => {
    // handle_new_user() previously created an org/profile/workspace but no
    // subscriptions row at all, so check_feature_access() and
    // useSubscriptionGate() both hard-denied every gated feature
    // (no_subscription / subscribed = false) for every real signup -- only
    // the sandboxed /demo flow had a free path, via a separate is_demo
    // bypass that doesn't apply to a real pilot org.
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.handle_new_user()");
    expect(migration).toMatch(
      /INSERT INTO public\.subscriptions \(\s*organization_id, tier, status, is_trial, trial_end, current_period_end,\s*stripe_customer_id, stripe_subscription_id\s*\)\s*VALUES \(\s*new_org_id, 'enterprise', 'trialing'/
    );
  });

  it("backfills organizations that signed up before this migration with no subscription row", () => {
    expect(migration).toMatch(/INSERT INTO public\.subscriptions[\s\S]*FROM public\.organizations o[\s\S]*WHERE NOT EXISTS/);
    expect(migration).toContain("SELECT 1 FROM public.subscriptions s WHERE s.organization_id = o.id");
  });

  it("uses a status that check_feature_access already treats as fully entitled", () => {
    // check_feature_access() only grants full tier access when
    // status IN ('active', 'trialing') -- confirm the pilot grant uses one
    // of those rather than inventing a third status the RPC doesn't know
    // about (which would silently re-introduce the paywall).
    const checkFeatureAccess = read("supabase/migrations/20260418013025_9d6a9b87-14bd-49bc-8ac3-5a59e4938028.sql");
    expect(checkFeatureAccess).toContain("_sub.status = 'active' OR _sub.status = 'trialing'");
    expect(migration).toContain("'trialing'");
  });
});
