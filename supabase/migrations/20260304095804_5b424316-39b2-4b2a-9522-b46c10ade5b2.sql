
-- Performance indexes for projects
CREATE INDEX idx_projects_organization_id ON public.projects (organization_id);
CREATE INDEX idx_projects_active_dataset_id ON public.projects (active_dataset_id);
CREATE INDEX idx_project_datasets_project_id ON public.project_datasets (project_id);
CREATE INDEX idx_project_datasets_dataset_id ON public.project_datasets (dataset_id);
