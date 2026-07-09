import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { onDecisionApproved } from "@/lib/decision-lifecycle";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Button } from "@/components/ui/button";
import DecisionEvidencePanel from "@/components/decision-intelligence/DecisionEvidencePanel";
import ExecutiveReviewFlow from "@/components/decisions/ExecutiveReviewFlow";
import {
  DEMO_DECISION,
  isDemoDecisionId,
  type ReviewableDecision,
} from "@/components/decisions/executive-review-flow";

const METRIC_BY_TYPE: Record<string, string> = {
  growth: "revenue",
  retention: "churn_rate",
  cost_optimization: "cost",
  strategic: "revenue",
  operational: "cost",
  risk: "revenue",
};

/**
 * UX-2 Decision Review (/decisions/:id/review): the linear executive review
 * surface. Approval routes onward to /decisions/:id/outcome.
 */
const DecisionReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useOrganization();
  const { activeDatasetId } = useProject();
  const { user } = useAuth();
  const { toast } = useToast();

  const isDemo = isDemoDecisionId(id);
  const [decision, setDecision] = useState<ReviewableDecision | null>(isDemo ? DEMO_DECISION : null);
  const [loading, setLoading] = useState(!isDemo);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDemo || !id || !currentOrgId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("decision_ledger")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("id", id)
        .maybeSingle();
      if (!error && data) setDecision(data as unknown as ReviewableDecision);
      setLoading(false);
    };
    load();
  }, [id, currentOrgId, isDemo]);

  const approve = async () => {
    if (!decision) return;
    if (isDemo) {
      toast({
        title: "Demo approval (simulation)",
        description: "Nothing was persisted — this is sample data.",
      });
      navigate(`/decisions/${decision.id}/outcome`);
      return;
    }
    setBusy(true);
    const decidedAt = new Date().toISOString();
    const { error } = await supabase
      .from("decision_ledger")
      .update({ decision_status: "approved", decided_at: decidedAt, decided_by: user?.id ?? null })
      .eq("id", decision.id);
    setBusy(false);
    if (error) {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
      return;
    }
    // Same post-approval lifecycle the Decision Ledger triggers (audit + outcome tracking).
    onDecisionApproved({
      decisionId: decision.id,
      organizationId: decision.organization_id ?? currentOrgId ?? "",
      userId: user?.id ?? null,
      recommendedAction: decision.recommended_action ?? "",
      confidence: decision.capped_confidence ?? decision.confidence_at_decision ?? 50,
      datasetId: activeDatasetId ?? null,
      expectedMetric: METRIC_BY_TYPE[decision.decision_type ?? ""] ?? decision.decision_type ?? null,
      evaluationWindowDays: 30,
    }).catch(() => {});
    toast({ title: "Decision approved", description: "Outcome tracking has started." });
    navigate(`/decisions/${decision.id}/outcome`);
  };

  const reject = async (reason: string) => {
    if (!decision) return;
    if (isDemo) {
      toast({
        title: "Demo rejection (simulation)",
        description: `Reason noted locally: “${reason}”. Nothing was persisted.`,
      });
      navigate("/executive-brief");
      return;
    }
    setBusy(true);
    const notes = `${decision.notes ? `${decision.notes}\n` : ""}Rejected in executive review: ${reason}`;
    const { error } = await supabase
      .from("decision_ledger")
      .update({ decision_status: "rejected", decided_at: new Date().toISOString(), notes })
      .eq("id", decision.id);
    setBusy(false);
    if (error) {
      toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Decision rejected", description: "Your reason was recorded on the decision." });
    navigate("/decisions");
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-5 space-y-1">
        <div className="flex items-center gap-2">
          <SidebarMobileToggle />
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground" asChild>
            <Link to="/executive-brief">
              <ArrowLeft className="h-3.5 w-3.5" />
              Executive Brief
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Review Decision</h1>
        <p className="text-sm text-muted-foreground">
          Work top to bottom: evidence, alternatives, impact, and risks — then record your decision.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading decision…
        </div>
      ) : decision ? (
        <ExecutiveReviewFlow
          decision={decision}
          isDemo={isDemo}
          busy={busy}
          onApprove={approve}
          onReject={reject}
          evidenceSlot={
            !isDemo && currentOrgId ? (
              <DecisionEvidencePanel
                decisionId={decision.id}
                organizationId={currentOrgId}
                decisionText={decision.recommended_action ?? ""}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-border/50 p-6 text-sm text-muted-foreground">
          This decision could not be found in your organization. It may have been removed.{" "}
          <Link to="/decisions" className="font-medium text-primary underline-offset-2 hover:underline">
            Open the Decision Ledger
          </Link>{" "}
          to see current decisions.
        </div>
      )}
    </div>
  );
};

export default DecisionReview;
