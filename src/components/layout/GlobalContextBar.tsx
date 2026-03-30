import { ChevronRight, Building2, FolderKanban, Database, Layers } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useProject } from "@/contexts/ProjectContext";
import { useDataset } from "@/contexts/DatasetContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

interface Segment {
  icon: React.ElementType;
  label: string | null;
  fallback: string;
  onClick?: () => void;
}

const ContextChip = ({ icon: Icon, label, fallback, onClick }: Segment) => {
  const text = label || fallback;
  const isMissing = !label;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors max-w-[140px] truncate ${
              isMissing
                ? "text-muted-foreground/50 bg-muted/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="truncate">{text}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const Separator = () => (
  <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
);

const GlobalContextBar = () => {
  const { currentOrg } = useOrganization();
  const { currentWorkspace } = useWorkspace();
  const { currentProject } = useProject();
  const { activeDataset } = useDataset();
  const navigate = useNavigate();

  return (
    <div className="h-7 border-b border-border/20 bg-muted/20 hidden md:flex items-center px-3 md:px-8 gap-1 shrink-0 overflow-x-auto scrollbar-hide">
      <ContextChip
        icon={Building2}
        label={currentOrg?.name ?? null}
        fallback="No org"
        onClick={() => navigate("/settings")}
      />
      <Separator />
      <ContextChip
        icon={Layers}
        label={currentWorkspace?.name ?? null}
        fallback="No workspace"
        onClick={() => navigate("/settings")}
      />
      <Separator />
      <ContextChip
        icon={FolderKanban}
        label={currentProject?.name ?? null}
        fallback="No project"
        onClick={() => navigate("/settings")}
      />
      <Separator />
      <ContextChip
        icon={Database}
        label={activeDataset?.name ?? null}
        fallback="No dataset"
        onClick={() => navigate("/data-upload")}
      />
    </div>
  );
};

export default GlobalContextBar;
