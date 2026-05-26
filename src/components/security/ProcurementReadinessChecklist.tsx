import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, ListChecks, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface ReadinessItem {
  id: string;
  category: string;
  control_key: string;
  control_label: string;
  status: "met" | "partial" | "missing" | "unknown";
  evidence_ref: string | null;
  evidence_payload: any;
  last_verified_at: string | null;
}

const statusBadge = (status: string) => {
  if (status === "met") return <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Met</Badge>;
  if (status === "partial") return <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Partial</Badge>;
  if (status === "missing") return <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-500"><XCircle className="w-3 h-3 mr-1" />Missing</Badge>;
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">Unknown</Badge>;
};

const ProcurementReadinessChecklist = () => {
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_procurement_readiness");
      setItems((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <Card className="border-border/50"><CardContent className="pt-6 text-center text-xs text-muted-foreground">Loading readiness…</CardContent></Card>;
  }

  if (items.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-6 text-center text-xs text-muted-foreground">
          Readiness items will populate after the first trust-metrics scan runs.
        </CardContent>
      </Card>
    );
  }

  const byCategory: Record<string, ReadinessItem[]> = {};
  for (const it of items) (byCategory[it.category] ||= []).push(it);

  const total = items.length;
  const met = items.filter((i) => i.status === "met").length;
  const pct = Math.round((met / total) * 100);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Procurement Readiness</h2>
          </div>
          <Badge variant="outline" className="text-xs">
            {met}/{total} controls met · {pct}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Every control derives from real system state — RLS coverage from <code>pg_policies</code>, explainability from
          <code> decision_ledger.evidence_sources</code>, retention from <code>datasets.is_stale</code>, etc.
          No manual checkboxes.
        </p>

        <div className="space-y-4">
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{cat}</div>
              <div className="space-y-1.5">
                {list.map((it) => (
                  <div key={it.id} className="flex items-start gap-2 p-2 rounded border border-border/40 bg-background/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm">{it.control_label}</span>
                        {statusBadge(it.status)}
                      </div>
                      {it.last_verified_at && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Verified {new Date(it.last_verified_at).toLocaleDateString("en-CA")}
                        </div>
                      )}
                    </div>
                    {it.evidence_ref && (
                      <Link to={it.evidence_ref} className="text-[10px] text-primary hover:underline flex items-center gap-0.5 shrink-0">
                        Evidence <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcurementReadinessChecklist;
