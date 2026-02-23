
-- =============================================
-- Phase 5.2: Executive Distribution Engine
-- =============================================

-- 1) Notification preferences per org
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role_type text NOT NULL CHECK (role_type IN ('ceo', 'cfo', 'cmo', 'coo')),
  email_enabled boolean NOT NULL DEFAULT true,
  email_recipients text[] NOT NULL DEFAULT '{}',
  slack_webhook_url text,
  slack_enabled boolean NOT NULL DEFAULT false,
  alert_threshold integer NOT NULL DEFAULT 50 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
  weekly_brief_enabled boolean NOT NULL DEFAULT false,
  escalation_threshold integer NOT NULL DEFAULT 85 CHECK (escalation_threshold >= 0 AND escalation_threshold <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role_type)
);

CREATE INDEX idx_notif_prefs_org ON public.notification_preferences(organization_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view notification prefs"
  ON public.notification_preferences FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert notification prefs"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins/owners can update notification prefs"
  ON public.notification_preferences FOR UPDATE
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins/owners can delete notification prefs"
  ON public.notification_preferences FOR DELETE
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- 2) Add escalation fields to executive_risk_index
ALTER TABLE public.executive_risk_index
  ADD COLUMN IF NOT EXISTS escalation_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS last_notified_at timestamp with time zone;

-- 3) Add notification tracking to executive_alerts
ALTER TABLE public.executive_alerts
  ADD COLUMN IF NOT EXISTS notified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS notification_channel text;

-- 4) Notification log for audit trail
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'slack', 'escalation')),
  subject text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_log_org ON public.notification_log(organization_id);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view notification log"
  ON public.notification_log FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
