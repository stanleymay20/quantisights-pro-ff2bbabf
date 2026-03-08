import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export interface OrgBranding {
  id: string;
  organization_id: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  company_name: string | null;
  custom_domain: string | null;
  favicon_url: string | null;
}

export function useOrgBranding() {
  const { currentOrg: organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: branding, isLoading } = useQuery({
    queryKey: ["org-branding", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { data } = await supabase
        .from("org_branding")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle();
      return data as OrgBranding | null;
    },
    enabled: !!organization?.id,
  });

  const saveBranding = useMutation({
    mutationFn: async (updates: Partial<OrgBranding>) => {
      if (!organization?.id) throw new Error("No organization");
      const { data, error } = await supabase
        .from("org_branding")
        .upsert(
          { organization_id: organization.id, ...updates, updated_at: new Date().toISOString() },
          { onConflict: "organization_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-branding"] });
      toast.success("Branding updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { branding, isLoading, saveBranding };
}
