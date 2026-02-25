
-- 1. Advisory Lifecycle Table
CREATE TABLE public.advisory_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  advisory_type text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'strategic',
  priority text NOT NULL DEFAULT 'medium',
  action text NOT NULL,
  expected_impact text,
  timeframe text,
  confidence integer DEFAULT 0,
  rationale text,
  kpi_affected jsonb DEFAULT '[]'::jsonb,
  playbook_steps jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  resolved_at timestamp with time zone,
  resolution_summary text,
  impact_score integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.advisory_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view advisories"
  ON public.advisory_instances FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins/owners can insert advisories"
  ON public.advisory_instances FOR INSERT
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins/owners can update advisories"
  ON public.advisory_instances FOR UPDATE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins/owners can delete advisories"
  ON public.advisory_instances FOR DELETE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE TRIGGER update_advisory_instances_updated_at
  BEFORE UPDATE ON public.advisory_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Enterprise Audit Log Table
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_id uuid,
  actor_type text NOT NULL DEFAULT 'user',
  action_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view audit log"
  ON public.audit_log FOR SELECT
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Audit log is append-only, no update/delete for users
-- Insert is done by service role in edge functions

CREATE INDEX idx_audit_log_org_created ON public.audit_log (organization_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log (action_type);
CREATE INDEX idx_advisory_instances_org_status ON public.advisory_instances (organization_id, status);

-- 3. Orchestration run tracking
CREATE TABLE public.orchestration_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  trigger_type text NOT NULL DEFAULT 'scheduled',
  steps_completed jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  duration_ms integer
);

ALTER TABLE public.orchestration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view orchestration runs"
  ON public.orchestration_runs FOR SELECT
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE INDEX idx_orchestration_runs_org ON public.orchestration_runs (organization_id, started_at DESC);
