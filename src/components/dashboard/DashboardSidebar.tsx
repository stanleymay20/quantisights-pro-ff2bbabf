import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, Lightbulb, TrendingUp, Activity, FileText, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/quantivis-logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Lightbulb, label: "Business Insights", path: "/dashboard" },
  { icon: TrendingUp, label: "Forecasting", path: "/dashboard" },
  { icon: Activity, label: "Data Monitoring", path: "/dashboard" },
  { icon: FileText, label: "Reports", path: "/dashboard" },
  { icon: Settings, label: "Settings", path: "/dashboard" },
];

const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

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
        {navItems.map((item, i) => {
          const isActive = i === 0;
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
