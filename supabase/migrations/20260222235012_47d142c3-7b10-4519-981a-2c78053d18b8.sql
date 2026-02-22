
-- Executive Command Mode configuration table
CREATE TABLE public.executive_modes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_type text NOT NULL CHECK (role_type IN ('ceo', 'cfo', 'cmo', 'coo')),
  priority_kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  alert_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role_type)
);

CREATE INDEX idx_executive_modes_org ON public.executive_modes(organization_id);

ALTER TABLE public.executive_modes ENABLE ROW LEVEL SECURITY;

-- RLS: org members can view
CREATE POLICY "Org members can view executive modes"
  ON public.executive_modes FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- RLS: admin/owner can insert
CREATE POLICY "Admins/owners can insert executive modes"
  ON public.executive_modes FOR INSERT
  WITH CHECK (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- RLS: admin/owner can update
CREATE POLICY "Admins/owners can update executive modes"
  ON public.executive_modes FOR UPDATE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- RLS: admin/owner can delete
CREATE POLICY "Admins/owners can delete executive modes"
  ON public.executive_modes FOR DELETE
  USING (get_user_org_role(auth.uid(), organization_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- Trigger for updated_at
CREATE TRIGGER update_executive_modes_updated_at
  BEFORE UPDATE ON public.executive_modes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
