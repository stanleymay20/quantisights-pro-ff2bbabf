import { useOrganization } from "@/hooks/useOrganization";
import SystemHealthDashboard from "@/components/dashboard/SystemHealthDashboard";

const SystemHealth = () => {
  const { currentOrg } = useOrganization();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor platform health, pipeline status, and infrastructure metrics.
        </p>
      </div>
      {currentOrg?.id ? (
        <SystemHealthDashboard orgId={currentOrg.id} />
      ) : (
        <p className="text-muted-foreground">Select an organization to view system health.</p>
      )}
    </div>
  );
};

export default SystemHealth;
