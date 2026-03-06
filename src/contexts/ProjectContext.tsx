import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Project {
  id: string;
  name: string;
  description: string | null;
  active_dataset_id: string | null;
  organization_id: string;
  created_at: string;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;
  activeDatasetId: string | null;
  loading: boolean;
  switchProject: (projectId: string) => void;
  setActiveDataset: (projectId: string, datasetId: string) => Promise<void>;
  createProject: (name: string, description?: string, workspaceIdOverride?: string) => Promise<Project>;
  attachDataset: (projectId: string, datasetId: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
};

const STORAGE_KEY = "quantivis_project_id";

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { currentWorkspaceId } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!currentOrgId) {
      setProjects([]);
      setCurrentProjectId(null);
      sessionStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Filter by workspace when available to ensure workspace switching cascades
    let query = supabase
      .from("projects")
      .select("id, name, description, active_dataset_id, organization_id, created_at")
      .eq("organization_id", currentOrgId);

    if (currentWorkspaceId) {
      query = query.eq("workspace_id", currentWorkspaceId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    setProjects(data);

    // Restore from sessionStorage, but only if it belongs to this workspace
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const valid = data.find((p) => p.id === stored);
    const nextId = valid ? valid.id : data[0]?.id ?? null;
    setCurrentProjectId(nextId);
    if (nextId) sessionStorage.setItem(STORAGE_KEY, nextId);
    else sessionStorage.removeItem(STORAGE_KEY);
    setLoading(false);
  }, [currentOrgId, currentWorkspaceId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const switchProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    sessionStorage.setItem(STORAGE_KEY, projectId);
  }, []);

  const setActiveDataset = useCallback(async (projectId: string, datasetId: string) => {
    await supabase
      .from("projects")
      .update({ active_dataset_id: datasetId })
      .eq("id", projectId);

    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, active_dataset_id: datasetId } : p))
    );
  }, []);

  const createProject = useCallback(async (name: string, description?: string, workspaceIdOverride?: string): Promise<Project> => {
    if (!currentOrgId || !user) throw new Error("No org or user");
    const wsId = workspaceIdOverride || currentWorkspaceId;

    const { data, error } = await supabase
      .from("projects")
      .insert({
        organization_id: currentOrgId,
        name,
        description: description || null,
        created_by: user.id,
        workspace_id: wsId,
      })
      .select("id, name, description, active_dataset_id, organization_id, created_at")
      .single();

    if (error || !data) throw error || new Error("Failed to create project");

    setProjects((prev) => [data, ...prev]);
    setCurrentProjectId(data.id);
    sessionStorage.setItem(STORAGE_KEY, data.id);
    return data;
  }, [currentOrgId, user, currentWorkspaceId]);

  const attachDataset = useCallback(async (projectId: string, datasetId: string) => {
    if (!user) return;
    await supabase.from("project_datasets").upsert(
      { project_id: projectId, dataset_id: datasetId, added_by: user.id },
      { onConflict: "project_id,dataset_id" }
    );
  }, [user]);

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;
  const activeDatasetId = currentProject?.active_dataset_id ?? null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        currentProjectId,
        activeDatasetId,
        loading,
        switchProject,
        setActiveDataset,
        createProject,
        attachDataset,
        refreshProjects: fetchProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
