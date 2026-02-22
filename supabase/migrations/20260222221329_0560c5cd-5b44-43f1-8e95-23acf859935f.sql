
-- Subscriptions table: single source of truth for billing state
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  price_id text,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- One active subscription per org
CREATE UNIQUE INDEX idx_subscriptions_org_active 
  ON public.subscriptions (organization_id) 
  WHERE status = 'active';

CREATE INDEX idx_subscriptions_stripe_customer 
  ON public.subscriptions (stripe_customer_id);

CREATE INDEX idx_subscriptions_stripe_sub 
  ON public.subscriptions (stripe_subscription_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Org members can view their subscription
CREATE POLICY "Org members can view subscription"
  ON public.subscriptions
  FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- Only system (service role) can insert/update/delete — no direct user writes
-- Edge functions use service_role key to manage this table

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
