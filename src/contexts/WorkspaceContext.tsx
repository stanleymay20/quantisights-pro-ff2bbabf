import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organization_id: string;
  created_at: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | null;
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
};

const STORAGE_KEY = "quantivis_workspace_id";

const toSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "workspace";

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!currentOrgId || !user) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      sessionStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch only workspaces the user is a member of (respects workspace-level isolation)
    const { data: memberships, error: memErr } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id);

    if (memErr || !memberships || memberships.length === 0) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      sessionStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return;
    }

    const memberWsIds = memberships.map((m) => m.workspace_id);

    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, slug, description, organization_id, created_at")
      .eq("organization_id", currentOrgId)
      .in("id", memberWsIds)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[WorkspaceContext] Failed to fetch workspaces:", error.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setLoading(false);
      return;
    }

    setWorkspaces(data);

    const stored = sessionStorage.getItem(STORAGE_KEY);
    const valid = data.find((w) => w.id === stored);
    const nextId = valid ? valid.id : data[0]?.id ?? null;
    setCurrentWorkspaceId(nextId);
    if (nextId) sessionStorage.setItem(STORAGE_KEY, nextId);
    else sessionStorage.removeItem(STORAGE_KEY);
    setLoading(false);
  }, [currentOrgId, user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    sessionStorage.setItem(STORAGE_KEY, workspaceId);
    // Force downstream context reset: clear stale project/dataset selections
    sessionStorage.removeItem("quantivis_project_id");
  }, []);

  const createWorkspace = useCallback(async (name: string, description?: string): Promise<Workspace> => {
    if (!currentOrgId || !user) throw new Error("No org or user");

    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) throw new Error("Workspace name is required");

    const slug = toSlug(trimmed);
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        organization_id: currentOrgId,
        name: trimmed,
        slug,
        description: description?.trim().slice(0, 500) || null,
        created_by: user.id,
      })
      .select("id, name, slug, description, organization_id, created_at")
      .single();

    if (error || !data) throw error || new Error("Failed to create workspace");

    // Auto-create default quotas
    await supabase.from("workspace_quotas").insert({ workspace_id: data.id });

    // Add creator as workspace admin
    await supabase.from("workspace_members").insert({
      workspace_id: data.id,
      user_id: user.id,
      role: "workspace_admin",
    });

    setWorkspaces((prev) => [...prev, data]);
    setCurrentWorkspaceId(data.id);
    sessionStorage.setItem(STORAGE_KEY, data.id);
    return data;
  }, [currentOrgId, user]);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        loading,
        switchWorkspace,
        createWorkspace,
        refreshWorkspaces: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
