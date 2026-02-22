import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import KPICards from "@/components/dashboard/KPICards";
import RevenueChart from "@/components/dashboard/RevenueChart";
import CustomerSegmentation from "@/components/dashboard/CustomerSegmentation";
import AIInsights from "@/components/dashboard/AIInsights";
import AnomalyDetection from "@/components/dashboard/AnomalyDetection";
import { Bell, User } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
          <h1 className="text-xl font-semibold font-display">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Robert Smith</span>
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-8 overflow-auto space-y-6">
          <KPICards />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>
            <CustomerSegmentation />
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <AIInsights />
            <AnomalyDetection />
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold font-display mb-1">Predictive Forecasting</h3>
              <p className="text-xs text-muted-foreground mb-4">Revenue sentiment</p>
              <div className="text-center py-8">
                <p className="text-4xl font-bold font-display gradient-text">+13.9%</p>
                <p className="text-sm text-muted-foreground mt-2">Projected growth for current period</p>
              </div>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">3-month</p>
                  <p className="font-semibold text-success">+8.2%</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">6-month</p>
                  <p className="font-semibold text-success">+13.9%</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
