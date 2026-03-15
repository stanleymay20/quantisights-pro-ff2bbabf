import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuthEvents } from "@/hooks/useAuthEvents";
import { useCallback, useEffect } from "react";

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

function parseDeviceName(ua: string | null): string {
  if (!ua) return "Unknown Device";
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android")) return "Android Device";
  if (ua.includes("Mac OS")) return "Mac";
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Linux")) return "Linux";
  return "Browser";
}

function parseBrowser(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  return "Other";
}

export function useSessionManager() {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { logAuthEvent } = useAuthEvents();
  const queryClient = useQueryClient();

  // Register/update current session on mount
  useEffect(() => {
    if (!user?.id || !currentOrgId) return;
    const upsertSession = async () => {
      // Check for existing active session
      const { data: existing } = await supabase
        .from("user_sessions" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("user_agent", navigator.userAgent)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existing && (existing as any[]).length > 0) {
        await supabase
          .from("user_sessions" as any)
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", (existing as any[])[0].id);
      } else {
        await supabase.from("user_sessions" as any).insert({
          user_id: user.id,
          organization_id: currentOrgId,
          user_agent: navigator.userAgent,
          device_name: parseDeviceName(navigator.userAgent),
        });
      }
    };
    upsertSession();
  }, [user?.id, currentOrgId]);

  // Heartbeat: update last_active_at periodically
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(async () => {
      await supabase
        .from("user_sessions" as any)
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("user_agent", navigator.userAgent)
        .is("revoked_at", null);
    }, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [user?.id]);

  // Fetch all sessions (for admin view or user's own)
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["user-sessions", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("user_sessions" as any)
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("last_active_at", { ascending: false });
      return (data as unknown as UserSession[]) ?? [];
    },
    enabled: !!user?.id && !!currentOrgId,
    refetchInterval: 30000,
  });

  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await supabase
        .from("user_sessions" as any)
        .update({ revoked_at: new Date().toISOString(), revoked_by: user?.id })
        .eq("id", sessionId);
      logAuthEvent({
        eventType: "session_revoke",
        metadata: { revoked_session_id: sessionId },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-sessions"] }),
  });

  const revokeAllOtherSessions = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      // Revoke all sessions except current user agent
      const { data: otherSessions } = await supabase
        .from("user_sessions" as any)
        .select("id")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .neq("user_agent", navigator.userAgent);

      if (otherSessions) {
        for (const s of otherSessions as any[]) {
          await supabase
            .from("user_sessions" as any)
            .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
            .eq("id", s.id);
        }
      }
      logAuthEvent({
        eventType: "session_revoke",
        metadata: { action: "revoke_all_other" },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-sessions"] }),
  });

  const activeSessions = sessions.filter((s) => !s.revoked_at);
  const revokedSessions = sessions.filter((s) => !!s.revoked_at);

  return {
    sessions,
    activeSessions,
    revokedSessions,
    isLoading,
    revokeSession: revokeSession.mutate,
    revokeAllOtherSessions: revokeAllOtherSessions.mutate,
    isRevoking: revokeSession.isPending || revokeAllOtherSessions.isPending,
    parseDeviceName,
    parseBrowser,
  };
}
