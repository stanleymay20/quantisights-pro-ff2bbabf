import { ReactNode } from "react";
import { useActiveDataContext } from "@/hooks/useActiveDataContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Database, Upload, FolderOpen } from "lucide-react";

interface DatasetRequiredProps {
  children: ReactNode;
  /** Module name shown in the empty state (e.g. "Intelligence", "Forecasting") */
  moduleName?: string;
}

/**
 * Wrapper that gates module rendering on active dataset availability.
 * Shows a clear empty state with navigation to Data Upload when no dataset is active.
 * Use this around any module that requires dataset-scoped data to function.
 */
const DatasetRequired = ({ children, moduleName = "This module" }: DatasetRequiredProps) => {
  const { hasOrg, hasProject, hasDataset, projectName, datasetName } = useActiveDataContext();
  const navigate = useNavigate();

  if (!hasOrg) {
    return (
      <EmptyState
        icon={<FolderOpen className="w-8 h-8 text-muted-foreground" />}
        title="No organization selected"
        description="Select an organization to access your data and intelligence."
      />
    );
  }

  if (!hasProject) {
    return (
      <EmptyState
        icon={<FolderOpen className="w-8 h-8 text-muted-foreground" />}
        title="No project selected"
        description="Create or select a project to organize your datasets."
        action={
          <Button variant="outline" size="sm" onClick={() => navigate("/data-upload")}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Data
          </Button>
        }
      />
    );
  }

  if (!hasDataset) {
    return (
      <EmptyState
        icon={<Database className="w-8 h-8 text-muted-foreground" />}
        title="No dataset active"
        description={`${moduleName} requires an active dataset. Upload data to your project "${projectName ?? "current project"}" to enable analytics across all modules.`}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate("/data-upload")}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Dataset
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export default DatasetRequired;
