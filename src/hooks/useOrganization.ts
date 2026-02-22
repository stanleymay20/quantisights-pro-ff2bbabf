import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Organization {
  id: string;
  name: string;
  role: string;
}

export const useOrganization = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrgId(null);
      setLoading(false);
      return;
    }

    const fetchOrgs = async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name)")
        .eq("user_id", user.id);

      if (error || !data) {
        setLoading(false);
        return;
      }

      const orgs: Organization[] = data.map((m: any) => ({
        id: m.organizations.id,
        name: m.organizations.name,
        role: m.role,
      }));

      setOrganizations(orgs);

      // Restore from session or use first
      const stored = sessionStorage.getItem("quantivis_org_id");
      const valid = orgs.find((o) => o.id === stored);
      setCurrentOrgId(valid ? valid.id : orgs[0]?.id ?? null);
      setLoading(false);
    };

    fetchOrgs();
  }, [user]);

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
    sessionStorage.setItem("quantivis_org_id", orgId);
  };

  const currentOrg = organizations.find((o) => o.id === currentOrgId) ?? null;

  return { organizations, currentOrgId, currentOrg, switchOrganization, loading };
};
