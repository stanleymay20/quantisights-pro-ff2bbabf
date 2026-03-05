import { useOrganization } from "@/hooks/useOrganization";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useProject } from "@/contexts/ProjectContext";
import { useDataset } from "@/contexts/DatasetContext";

/**
 * Central hook that resolves the full data context for any module.
 * Every data-dependent module should use this instead of manually
 * calling useOrganization + useProject + useDataset individually.
 *
 * Returns the complete hierarchy: Org → Workspace → Project → Dataset
 */
export const useActiveDataContext = () => {
  const { currentOrgId, currentOrg } = useOrganization();
  const { currentWorkspaceId } = useWorkspace();
  const { currentProject, currentProjectId, activeDatasetId } = useProject();
  const { activeDataset } = useDataset();

  return {
    // IDs for query scoping
    orgId: currentOrgId,
    workspaceId: currentWorkspaceId,
    projectId: currentProjectId,
    datasetId: activeDatasetId,

    // Rich objects for display
    orgName: currentOrg?.name ?? null,
    projectName: currentProject?.name ?? null,
    datasetName: activeDataset?.name ?? null,

    // Readiness flags
    hasOrg: !!currentOrgId,
    hasProject: !!currentProjectId,
    hasDataset: !!activeDatasetId,

    /** True when the full context is resolved and data queries can proceed */
    isReady: !!currentOrgId && !!currentProjectId && !!activeDatasetId,
  };
};
