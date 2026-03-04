
-- =====================================================
-- WORKSPACE LAYER: Org → Workspace → Project hierarchy
-- =====================================================

-- 1) Workspaces table
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

-- 2) Workspace members (role within workspace)
CREATE TYPE public.workspace_role AS ENUM ('workspace_admin', 'workspace_editor', 'workspace_viewer');

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'workspace_editor',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- 3) Usage metering table (per-workspace, daily)
CREATE TABLE public.usage_metering (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  metric_name text NOT NULL, -- 'datasets_created', 'rows_ingested', 'api_calls', 'simulations', 'copilot_queries'
  metric_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period_date, metric_name)
);

-- 4) Workspace quotas (per-workspace limits, derived from plan)
CREATE TABLE public.workspace_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  max_datasets integer NOT NULL DEFAULT 1,
  max_rows_per_day bigint NOT NULL DEFAULT 50000,
  max_api_calls_per_day integer NOT NULL DEFAULT 100,
  max_simulations_per_day integer NOT NULL DEFAULT 5,
  max_copilot_queries_per_day integer NOT NULL DEFAULT 0,
  max_team_seats integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Add workspace_id to projects (nullable for migration, will be backfilled)
ALTER TABLE public.projects ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 6) Indexes for scale
CREATE INDEX idx_workspaces_org ON public.workspaces(organization_id);
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX idx_usage_metering_workspace_date ON public.usage_metering(workspace_id, period_date);
CREATE INDEX idx_usage_metering_org ON public.usage_metering(organization_id, period_date);
CREATE INDEX idx_projects_workspace ON public.projects(workspace_id);

-- 7) RLS on workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can insert workspaces"
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (
    get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update workspaces"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (
    get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete workspaces"
  ON public.workspaces FOR DELETE TO authenticated
  USING (
    get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  );

-- 8) RLS on workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workspace members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND is_org_member(auth.uid(), w.organization_id)
    )
  );

CREATE POLICY "Workspace admins can insert members"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND get_user_org_role(auth.uid(), w.organization_id) IN ('owner', 'admin')
    )
  );

CREATE POLICY "Workspace admins can delete members"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND get_user_org_role(auth.uid(), w.organization_id) IN ('owner', 'admin')
    )
  );

-- 9) RLS on usage_metering
ALTER TABLE public.usage_metering ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view usage metering"
  ON public.usage_metering FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

-- 10) RLS on workspace_quotas
ALTER TABLE public.workspace_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workspace quotas"
  ON public.workspace_quotas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_quotas.workspace_id
      AND is_org_member(auth.uid(), w.organization_id)
    )
  );

-- 11) Security definer function for quota checking
CREATE OR REPLACE FUNCTION public.check_workspace_quota(
  _workspace_id uuid,
  _metric_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage bigint;
  quota_limit bigint;
  result jsonb;
BEGIN
  -- Get current usage for today
  SELECT COALESCE(metric_value, 0) INTO current_usage
  FROM public.usage_metering
  WHERE workspace_id = _workspace_id
    AND period_date = CURRENT_DATE
    AND metric_name = _metric_name;

  IF current_usage IS NULL THEN
    current_usage := 0;
  END IF;

  -- Get quota limit
  SELECT
    CASE _metric_name
      WHEN 'datasets_created' THEN q.max_datasets
      WHEN 'rows_ingested' THEN q.max_rows_per_day
      WHEN 'api_calls' THEN q.max_api_calls_per_day
      WHEN 'simulations' THEN q.max_simulations_per_day
      WHEN 'copilot_queries' THEN q.max_copilot_queries_per_day
      ELSE 999999
    END INTO quota_limit
  FROM public.workspace_quotas q
  WHERE q.workspace_id = _workspace_id;

  IF quota_limit IS NULL THEN
    quota_limit := 999999; -- no quota = unlimited
  END IF;

  result := jsonb_build_object(
    'current_usage', current_usage,
    'quota_limit', quota_limit,
    'allowed', current_usage < quota_limit,
    'remaining', GREATEST(quota_limit - current_usage, 0)
  );

  RETURN result;
END;
$$;

-- 12) Increment usage function
CREATE OR REPLACE FUNCTION public.increment_workspace_usage(
  _workspace_id uuid,
  _org_id uuid,
  _metric_name text,
  _increment bigint DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usage_metering (workspace_id, organization_id, period_date, metric_name, metric_value)
  VALUES (_workspace_id, _org_id, CURRENT_DATE, _metric_name, _increment)
  ON CONFLICT (workspace_id, period_date, metric_name)
  DO UPDATE SET metric_value = usage_metering.metric_value + _increment,
               updated_at = now();
END;
$$;

-- 13) Auto-create default workspace on handle_new_user
-- We modify handle_new_user to also create a default workspace
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

  RETURN NEW;
END;
$$;
