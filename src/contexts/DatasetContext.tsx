import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/ProjectContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Dataset {
  id: string;
  name: string;
  organization_id: string;
  status: string;
  row_count: number | null;
  is_stale: boolean | null;
  created_at: string;
  file_path: string | null;
}

interface DatasetContextType {
  datasets: Dataset[];
  activeDataset: Dataset | null;
  activeDatasetId: string | null;
  loading: boolean;
  refreshDatasets: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export const useDataset = () => {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used within DatasetProvider");
  return ctx;
};

export const DatasetProvider = ({ children }: { children: ReactNode }) => {
  const { currentProject, currentProjectId, activeDatasetId } = useProject();
  const { currentWorkspaceId } = useWorkspace();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDatasets = useCallback(async () => {
    if (!currentProjectId || !currentProject) {
      setDatasets([]);
      return;
    }

    setLoading(true);
    const { data: links, error: linkErr } = await supabase
      .from("project_datasets")
      .select("dataset_id")
      .eq("project_id", currentProjectId);

    if (linkErr) {
      console.error("[DatasetContext] Failed to fetch project_datasets:", linkErr.message);
      setDatasets([]);
      setLoading(false);
      return;
    }

    if (!links || links.length === 0) {
      setDatasets([]);
      setLoading(false);
      return;
    }

    const dsIds = links.map(l => l.dataset_id);
    const { data, error } = await supabase
      .from("datasets")
      .select("id, name, organization_id, status, row_count, is_stale, created_at, file_path")
      .in("id", dsIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[DatasetContext] Failed to fetch datasets:", error.message);
    }
    if (!error && data) {
      setDatasets(data);
    }
    setLoading(false);
  }, [currentProjectId, currentProject]);

  // Eagerly clear stale datasets when project changes, then re-fetch
  useEffect(() => {
    setDatasets([]);
    fetchDatasets();
  }, [fetchDatasets]);

  const activeDataset = useMemo(
    () => datasets.find(d => d.id === activeDatasetId) ?? null,
    [datasets, activeDatasetId]
  );

  return (
    <DatasetContext.Provider
      value={{
        datasets,
        activeDataset,
        activeDatasetId,
        loading,
        refreshDatasets: fetchDatasets,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
};
