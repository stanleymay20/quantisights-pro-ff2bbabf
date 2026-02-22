import { ChevronDown, Building2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface OrgSwitcherProps {
  organizations: { id: string; name: string; role: string }[];
  currentOrg: { id: string; name: string; role: string } | null;
  onSwitch: (orgId: string) => void;
}

const OrgSwitcher = ({ organizations, currentOrg, onSwitch }: OrgSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (organizations.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium truncate max-w-[160px]">{currentOrg?.name ?? "No Organization"}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-sm"
      >
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium truncate max-w-[160px]">{currentOrg?.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 glass-card rounded-lg border border-border p-1 z-50 shadow-xl">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => { onSwitch(org.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                org.id === currentOrg?.id ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
              }`}
            >
              <div className="font-medium truncate">{org.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{org.role}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgSwitcher;
