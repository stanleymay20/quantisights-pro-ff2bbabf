import { Link, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Upload, FileText, Lightbulb, TrendingUp, Settings, CreditCard, LogOut, Database, BarChart3, Shuffle, Crown, Users, Building2, Search, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/quantivis-logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Database, label: "Data Sources", path: "/data-sources" },
  { icon: Upload, label: "Data Upload", path: "/data-upload" },
  { icon: BarChart3, label: "KPI Builder", path: "/kpis" },
  { icon: Search, label: "Diagnostics", path: "/diagnostics" },
  { icon: Zap, label: "Advisory", path: "/advisory" },
  { icon: Shuffle, label: "Scenarios", path: "/scenarios" },
  { icon: Crown, label: "Executive Command", path: "/executive" },
  { icon: FileText, label: "Reports", path: "/reports" },
  { icon: Users, label: "Team", path: "/team" },
  { icon: Building2, label: "Client Portfolio", path: "/clients" },
  { icon: CreditCard, label: "Billing", path: "/billing" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="p-6">
        <Link to="/">
          <img src={logo} alt="Quantivis Global" className="h-10 w-auto" />
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
