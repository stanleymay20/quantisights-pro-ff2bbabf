import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface OrgMemberRow {
  organization_id: string;
  role: string;
  organizations: { id: string; name: string };
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

      const orgs: Organization[] = (data as unknown as OrgMemberRow[]).map((m) => ({
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
    // Cascade: clear downstream context to prevent cross-org data leakage
    sessionStorage.removeItem("quantivis_workspace_id");
    sessionStorage.removeItem("quantivis_project_id");
    // Clear ML cache on org switch to prevent cross-tenant data
    clearMLCache();
  };

  const currentOrg = organizations.find((o) => o.id === currentOrgId) ?? null;

  return { organizations, currentOrgId, currentOrg, switchOrganization, loading };
};

/** Clears the module-level ML cache to prevent cross-org leakage */
function clearMLCache() {
  try {
    // Dispatch a custom event that useMLEngine listens to
    window.dispatchEvent(new CustomEvent("quantivis:org-switch"));
  } catch (e: unknown) {
    // Non-critical: SSR or test environment where window is unavailable
    console.error("[useOrganization] ML cache clear failed:", e instanceof Error ? e.message : e);
  }
}
