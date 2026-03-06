import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Plus, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ProjectSwitcher = () => {
  const { projects, currentProject, switchProject, createProject } = useProject();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProject(newName.trim());
      toast({ title: "Project created", description: `"${newName.trim()}" is now active.` });
      setShowCreate(false);
      setNewName("");
    } catch (e: any) {
      toast({ title: "Failed to create project", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (projects.length === 0 && !currentProject) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all border border-border/30">
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="max-w-[140px] truncate">{currentProject?.name || "No project"}</span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => switchProject(p.id)}
              className="flex items-center justify-between"
            >
              <span className="truncate">{p.name}</span>
              {p.id === currentProject?.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-3.5 h-3.5" />
            New Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. Middle East Macro 2024"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectSwitcher;
