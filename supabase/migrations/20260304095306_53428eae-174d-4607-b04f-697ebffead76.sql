
-- Projects table: analysis containers within an organization
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active_dataset_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project datasets: many-to-many join
CREATE TABLE public.project_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, dataset_id)
);

-- Add FK for active_dataset_id
ALTER TABLE public.projects
  ADD CONSTRAINT projects_active_dataset_fkey
  FOREIGN KEY (active_dataset_id) REFERENCES public.datasets(id) ON DELETE SET NULL;

-- RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Admins can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role]));

-- RLS on project_datasets
ALTER TABLE public.project_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view project_datasets"
  ON public.project_datasets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_datasets.project_id
    AND is_org_member(auth.uid(), p.organization_id)
  ));

CREATE POLICY "Org members can insert project_datasets"
  ON public.project_datasets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_datasets.project_id
    AND is_org_member(auth.uid(), p.organization_id)
  ) AND added_by = auth.uid());

CREATE POLICY "Admins can delete project_datasets"
  ON public.project_datasets FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_datasets.project_id
    AND get_user_org_role(auth.uid(), p.organization_id) = ANY(ARRAY['owner'::org_role, 'admin'::org_role])
  ));

-- Trigger for updated_at on projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
