import { memo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, TrendingUp, Gavel, Brain, AlertTriangle, Clock } from "lucide-react";

interface WhatChangedWidgetProps {
  organizationId: string;
}

interface ChangeSummary {
  newInsights: number;
  newDecisions: number;
  newOutcomes: number;
  calibrationUpdated: boolean;
  criticalAlerts: number;
  lastLoginAt: string | null;
}

const WhatChangedWidget = memo(({ organizationId }: WhatChangedWidgetProps) => {
  const [changes, setChanges] = useState<ChangeSummary | null>(null);

  useEffect(() => {
    const fetch = async () => {
      // Use last session timestamp, default to 24h ago
      const lastLogin = localStorage.getItem("quantivis_last_seen") ?? 
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [insightsRes, decisionsRes, outcomesRes, calRes, alertsRes] = await Promise.all([
        supabase
          .from("insights")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .gte("created_at", lastLogin),
        supabase
          .from("decision_ledger")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .gte("created_at", lastLogin),
        supabase
          .from("decision_outcomes")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .gte("created_at", lastLogin),
        supabase
          .from("calibration_models")
          .select("computed_at")
          .eq("organization_id", organizationId)
          .gte("computed_at", lastLogin)
          .limit(1),
        supabase
          .from("advisory_instances")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("priority", "critical")
          .eq("status", "open")
          .gte("created_at", lastLogin),
      ]);

      setChanges({
        newInsights: insightsRes.count ?? 0,
        newDecisions: decisionsRes.count ?? 0,
        newOutcomes: outcomesRes.count ?? 0,
        calibrationUpdated: (calRes.data?.length ?? 0) > 0,
        criticalAlerts: alertsRes.count ?? 0,
        lastLoginAt: lastLogin,
      });

      // Update last seen
      localStorage.setItem("quantivis_last_seen", new Date().toISOString());
    };
    fetch();
  }, [organizationId]);

  if (!changes) return null;

  const totalChanges = changes.newInsights + changes.newDecisions + changes.newOutcomes +
    (changes.calibrationUpdated ? 1 : 0) + changes.criticalAlerts;

  if (totalChanges === 0) return null;

  const items = [
    changes.newInsights > 0 && {
      icon: <TrendingUp className="w-3.5 h-3.5 text-primary" />,
      text: `${changes.newInsights} new insight${changes.newInsights > 1 ? "s" : ""}`,
    },
    changes.newDecisions > 0 && {
      icon: <Gavel className="w-3.5 h-3.5 text-primary" />,
      text: `${changes.newDecisions} new decision${changes.newDecisions > 1 ? "s" : ""}`,
    },
    changes.newOutcomes > 0 && {
      icon: <Brain className="w-3.5 h-3.5 text-emerald-500" />,
      text: `${changes.newOutcomes} outcome${changes.newOutcomes > 1 ? "s" : ""} evaluated`,
    },
    changes.calibrationUpdated && {
      icon: <Brain className="w-3.5 h-3.5 text-amber-500" />,
      text: "Calibration model updated",
    },
    changes.criticalAlerts > 0 && {
      icon: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
      text: `${changes.criticalAlerts} critical alert${changes.criticalAlerts > 1 ? "s" : ""}`,
    },
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Since your last visit</span>
          {changes.lastLoginAt && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-1 ml-auto">
              <Clock className="w-2.5 h-2.5" />
              {new Date(changes.lastLoginAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {item.icon}
              <span className="text-[11px]">{item.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

WhatChangedWidget.displayName = "WhatChangedWidget";

export default WhatChangedWidget;
