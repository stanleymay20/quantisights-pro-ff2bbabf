-- Pilot phase: users should not have to pay to use the product.
--
-- handle_new_user() creates an organization, profile, and workspace on
-- signup but never inserted a subscriptions row. check_feature_access()
-- and the client-side useSubscription()/useSubscriptionGate() both treat
-- "no subscriptions row" as a hard paywall (no_subscription / subscribed
-- = false), so every real signup was blocked from any gated feature
-- (simulations, advisory, forecasting, SSO, ...) with no free/trial path
-- at all -- only the sandboxed /demo flow bypassed this, via a separate
-- is_demo check that doesn't apply to a real pilot org.
--
-- Grants full-tier, no-payment access for the pilot phase: new orgs get
-- a 'trialing' subscription automatically, and existing orgs that signed
-- up before this migration and are still stuck with no subscription row
-- get the same grant backfilled. This is intentionally easy to revert --
-- swap the tier/duration below, or replace with real Stripe checkout --
-- once the pilot phase ends and paid plans are enforced.

-- ========== 1. Backfill existing orgs with no subscription row ==========
INSERT INTO public.subscriptions (
  organization_id, tier, status, is_trial, trial_end, current_period_end,
  stripe_customer_id, stripe_subscription_id
)
SELECT
  o.id, 'enterprise', 'trialing', true, now() + interval '1 year', now() + interval '1 year',
  'pilot_cus_' || o.id::text, 'pilot_sub_' || o.id::text
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.organization_id = o.id
);

-- ========== 2. Grant every new signup the same pilot access ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  new_workspace_id uuid;
BEGIN
  -- Create organization for the user
  INSERT INTO public.organizations (name, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Organization',
    NEW.id
  )
  RETURNING id INTO new_org_id;

  -- Create profile with org
  INSERT INTO public.profiles (user_id, full_name, organization_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), new_org_id);

  -- Add as owner in organization_members
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  -- Keep app-level role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  -- Create default workspace
  INSERT INTO public.workspaces (organization_id, name, slug, created_by)
  VALUES (new_org_id, 'Default', 'default', NEW.id)
  RETURNING id INTO new_workspace_id;

  -- Add user as workspace admin
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'workspace_admin');

  -- Create default quotas (starter tier)
  INSERT INTO public.workspace_quotas (workspace_id)
  VALUES (new_workspace_id);

  -- Pilot phase: full access, no payment required. See migration header.
  INSERT INTO public.subscriptions (
    organization_id, tier, status, is_trial, trial_end, current_period_end,
    stripe_customer_id, stripe_subscription_id
  )
  VALUES (
    new_org_id, 'enterprise', 'trialing', true, now() + interval '1 year', now() + interval '1 year',
    'pilot_cus_' || new_org_id::text, 'pilot_sub_' || new_org_id::text
  );

  RETURN NEW;
END;
$$;
