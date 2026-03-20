import { createContext, useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Upload, FileText, TrendingUp, Settings, CreditCard, LogOut,
  Database, BarChart3, Shuffle, Users, Building2, Search, Zap, Menu, X,
  BookOpen, Target, Brain, MessageSquare, GitBranch, Globe,
  Sparkles, GitCommitVertical, Crosshair, Bell, Cable,
  Briefcase, ChevronDown, Shield, Eye, Compass, FlaskConical,
  ClipboardCheck, AlertOctagon, RotateCcw, Award, Layers, Activity,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import logo from "@/assets/quantivis-logo.png";
import WorkspaceSwitcher from "@/components/dashboard/WorkspaceSwitcher";
import KeyboardShortcutsModal from "@/components/dashboard/KeyboardShortcutsModal";
import HelpTooltip from "@/components/ui/help-tooltip";
import { cn } from "@/lib/utils";

/** Plain-English explanations for sidebar items that use jargon */
const ITEM_HELP: Record<string, string> = {
  "Causal Inference": "Discover what actually caused a change — not just correlations, but real cause-and-effect relationships.",
  "Cognitive Bias": "Detect mental shortcuts that lead to bad decisions — like anchoring, confirmation bias, or overconfidence.",
  "Counterfactual": "Ask 'what if we had done X instead?' — explore alternate outcomes to learn from past decisions.",
  "Calibration": "Measure how well your confidence predictions match reality. Great calibration = trustworthy judgment.",
  "Benchmarking": "Compare your metrics against industry peers to see where you lead and where you lag.",
  "Decision Intelligence": "A unified view of pending decisions, their expected impact, and recommended actions.",
  "Decision Ledger": "Permanent record of every strategic decision — who made it, why, and what happened.",
  "Execution": "Track decision execution — actions, status, deadlines, and outcomes in real time.",
  "What-If Branching": "Create alternate future scenarios and compare outcomes side by side.",
  "Simulations": "Run Monte Carlo simulations — thousands of random scenarios to stress-test your strategy.",
  "Strategy Pack": "Pre-built strategic frameworks and templates for common business decisions.",
  "Misses Analysis": "Review decisions where outcomes missed predictions — learn what went wrong and why.",
  "Data Lineage": "Trace every number back to its source — full transparency on where your data comes from.",
  "Pipeline Monitor": "Real-time status of data ingestion, processing, and quality checks.",
  "OKR Alignment": "Link your Objectives & Key Results to the data — track progress with live metrics.",
  "Alert Playbooks": "Automated response plans that trigger when specific metric thresholds are breached.",
  "Pilot Audit": "Pre-launch checklist ensuring your data and configuration are production-ready.",
  "Governance Maturity": "Score your organization across 6 data governance dimensions — strategy, quality, culture, and more.",
  "Governance": "Executive command view — KPIs, risks, steward coverage, and recommended actions in one place.",
  "Decision Fitness": "Diagnose your organization's strategic decision-making capacity across 7 dimensions from the Decision Fitness Framework.",
};

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavSection {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navSections: NavSection[] = [
  {
    label: "Portfolio",
    icon: Briefcase,
    defaultOpen: true,
    items: [
      { icon: Briefcase, label: "Overview", path: "/portfolio" },
      { icon: LayoutDashboard, label: "Command Center", path: "/dashboard" },
      { icon: BarChart3, label: "KPI Builder", path: "/kpis" },
      { icon: Compass, label: "Executive View", path: "/executive" },
    ],
  },
  {
    label: "Intelligence",
    icon: Brain,
    items: [
      { icon: Search, label: "Diagnostics", path: "/diagnostics" },
      { icon: Zap, label: "Advisory", path: "/advisory" },
      { icon: Brain, label: "Decision Intelligence", path: "/decision-intelligence" },
      { icon: BookOpen, label: "Decision Ledger", path: "/decisions" },
      { icon: Zap, label: "Execution", path: "/execution" },
      { icon: Sparkles, label: "Forecasting", path: "/forecasting" },
      { icon: Target, label: "Benchmarking", path: "/benchmarking" },
      { icon: MessageSquare, label: "Ask Quantivis", path: "/ask" },
      { icon: FlaskConical, label: "Causal Inference", path: "/causal-inference" },
      { icon: AlertOctagon, label: "Cognitive Bias", path: "/cognitive-bias" },
      { icon: RotateCcw, label: "Counterfactual", path: "/counterfactual" },
      { icon: Award, label: "Calibration", path: "/calibration" },
      { icon: Crosshair, label: "Decision Fitness", path: "/decision-fitness" },
    ],
  },
  {
    label: "Strategy",
    icon: TrendingUp,
    items: [
      { icon: Shuffle, label: "Scenarios", path: "/scenarios" },
      { icon: GitBranch, label: "What-If Branching", path: "/branching" },
      { icon: TrendingUp, label: "Simulations", path: "/simulations" },
      { icon: Globe, label: "Market Intelligence", path: "/market-intelligence" },
      { icon: Bell, label: "Alert Playbooks", path: "/alert-playbooks" },
      { icon: FileText, label: "Reports", path: "/reports" },
      { icon: Crosshair, label: "OKR Alignment", path: "/okrs" },
      { icon: Shield, label: "Strategy Pack", path: "/strategy-pack" },
      { icon: Eye, label: "Misses Analysis", path: "/misses" },
    ],
  },
  {
    label: "Data",
    icon: Database,
    items: [
      { icon: Cable, label: "Data Connectors", path: "/data-connectors" },
      { icon: Database, label: "Data Sources", path: "/data-sources" },
      { icon: Layers, label: "Data Catalog", path: "/data-catalog" },
      { icon: Layers, label: "Dataset Explorer", path: "/dataset-explorer" },
      { icon: Upload, label: "CSV Upload", path: "/data-upload" },
      { icon: GitCommitVertical, label: "Data Lineage", path: "/lineage" },
      { icon: Activity, label: "Pipeline Monitor", path: "/pipeline" },
      { icon: BookOpen, label: "API Reference", path: "/api-docs" },
      { icon: ClipboardCheck, label: "Pilot Audit", path: "/pilot-audit" },
    ],
  },
  {
    label: "Organization",
    icon: Building2,
    items: [
      { icon: Users, label: "Team", path: "/team" },
      { icon: Building2, label: "Clients", path: "/clients" },
      { icon: CreditCard, label: "Billing", path: "/billing" },
      { icon: Shield, label: "Governance", path: "/governance" },
      { icon: Award, label: "Governance Maturity", path: "/governance-maturity" },
      { icon: Shield, label: "Compliance", path: "/compliance" },
      { icon: Shield, label: "SSO / SAML", path: "/sso" },
      { icon: Eye, label: "Privacy", path: "/privacy-dashboard" },
      { icon: Settings, label: "Settings", path: "/settings" },
    ],
  },
];

// Context for mobile sidebar toggle
const SidebarContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });
export const useSidebarToggle = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen(p => !p) }}>
      {children}
    </SidebarContext.Provider>
  );
};

/** Mobile hamburger button — render in page headers */
export const SidebarMobileToggle = () => {
  const isMobile = useIsMobile();
  const { toggle } = useSidebarToggle();
  if (!isMobile) return null;
  return (
    <button onClick={toggle} className="p-2 -ml-2 rounded-lg hover:bg-secondary/60 transition-colors lg:hidden">
      <Menu className="w-5 h-5 text-muted-foreground" />
    </button>
  );
};

const CollapsibleSection = ({ section, location, onNavClick }: { section: NavSection; location: ReturnType<typeof useLocation>; onNavClick: () => void }) => {
  const hasActiveChild = section.items.some(item => location.pathname === item.path);
  const [open, setOpen] = useState(section.defaultOpen || hasActiveChild);

  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors",
          hasActiveChild
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
        )}
      >
        <section.icon className="w-4 h-4" />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-border/40 mt-0.5 space-y-0.5">
          {section.items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavClick}
                className={cn(
                  "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("w-[15px] h-[15px] transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                {item.label}
                {ITEM_HELP[item.label] && (
                  <HelpTooltip content={ITEM_HELP[item.label]} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                {isActive && !ITEM_HELP[item.label] && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { open, toggle } = useSidebarToggle();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleNavClick = () => {
    if (isMobile) toggle();
  };

  const sidebarContent = (
    <aside className="w-56 h-screen h-[100dvh] bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 safe-area-left safe-area-top safe-area-bottom">
      <div className="p-4 pb-3 flex items-center justify-between">
        <Link to="/" onClick={handleNavClick}>
          <img src={logo} alt="Quantivis" className="h-7 w-auto" />
        </Link>
        {isMobile && (
          <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 px-2 overflow-y-auto space-y-1">
        {navSections.map((section) => (
          <CollapsibleSection
            key={section.label}
            section={section}
            location={location}
            onNavClick={handleNavClick}
          />
        ))}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <Link
          to="/docs"
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors w-full",
            location.pathname === "/docs"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <BookOpen className="w-[15px] h-[15px] text-muted-foreground" />
          Docs
        </Link>
        <KeyboardShortcutsModal />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          <LogOut className="w-[15px] h-[15px] text-muted-foreground" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  if (!isMobile) return sidebarContent;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={toggle} />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default DashboardSidebar;
