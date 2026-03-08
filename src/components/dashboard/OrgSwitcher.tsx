import { ChevronDown, Building2, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface OrgSwitcherProps {
  organizations: { id: string; name: string; role: string }[];
  currentOrg: { id: string; name: string; role: string } | null;
  onSwitch: (orgId: string) => void;
}

const OrgSwitcher = ({ organizations, currentOrg, onSwitch }: OrgSwitcherProps) => {
  if (organizations.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium truncate max-w-[160px]">{currentOrg?.name ?? "No Organization"}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium max-w-[200px]">
          <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{currentOrg?.name}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => onSwitch(org.id)}
            className="flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{org.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{org.role}</div>
            </div>
            {org.id === currentOrg?.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default OrgSwitcher;
