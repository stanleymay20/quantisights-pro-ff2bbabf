import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, CheckCircle2, Clock, TrendingUp, TrendingDown,
  Loader2, Plus, PlayCircle, Target, BarChart3, ArrowRight,
  ShieldCheck, AlertTriangle, Activity,
} from "lucide-react";

interface Decision {
  id: string;
  organization_id: string;
  advisory_instance_id: string | null;
  decision_type: string;
  recommended_action: string;
  chosen_action: string | null;
  decision_status: string;
  execution_status: string;
  outcome_delta: number | null;
  confidence_at_decision: number | null;
  confidence_updated: number | null;
  baseline_value: number | null;
  actual_value: number | null;
  kpi_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  execution_started_at: string | null;
  execution_completed_at: string | null;
  outcome_measured_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  prediction_accuracy_score: number | null;
  calibration_error: number | null;
  raw_confidence: number | null;
  capped_confidence: number | null;
  confidence_cap_reason: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Pending" },
  approved: { bg: "bg-sky-500/10", text: "text-sky-500", label: "Approved" },
  rejected: { bg: "bg-destructive/10", text: "text-destructive", label: "Rejected" },
  deferred: { bg: "bg-muted", text: "text-muted-foreground", label: "Deferred" },
};

const EXEC_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  not_started: { bg: "bg-muted", text: "text-muted-foreground", label: "Not Started" },
  in_progress: { bg: "bg-sky-500/10", text: "text-sky-500", label: "In Progress" },
  completed: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Completed" },
  blocked: { bg: "bg-destructive/10", text: "text-destructive", label: "Blocked" },
};

const DecisionLedgerPage = () => {
  const { currentOrgId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [newType, setNewType] = useState("strategic");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchDecisions = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("decision_ledger")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setDecisions(data as unknown as Decision[]);
    setLoading(false);
  };

  useEffect(() => { if (currentOrgId) fetchDecisions(); }, [currentOrgId]);

  const createDecision = async () => {
    if (!currentOrgId || !newAction.trim()) return;
    const { error } = await supabase
      .from("decision_ledger")
      .insert({
        organization_id: currentOrgId,
        recommended_action: newAction,
        decision_type: newType,
        decided_by: user?.id,
      } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Decision logged" });
      setNewAction("");
      setShowCreate(false);
      fetchDecisions();
    }
  };

  const updateDecision = async (id: string, updates: Record<string, any>) => {
    setUpdatingId(id);

    // If completing, compute calibration metrics
    if (updates.execution_status === "completed") {
      const decision = decisions.find(d => d.id === id);
      if (decision) {
        const conf = decision.confidence_at_decision || decision.capped_confidence || 50;
        const hasOutcome = decision.outcome_delta !== null;
        const outcomePositive = (decision.outcome_delta || 0) >= 0;
        // Calibration error: |predicted_probability - actual_outcome|
        const calibrationError = Math.abs(conf - (outcomePositive ? 100 : 0));
        // Prediction accuracy: how close confidence was to actual outcome direction
        const predictionAccuracy = hasOutcome ? Math.max(0, 100 - calibrationError) : null;

        updates.calibration_error = calibrationError;
        updates.prediction_accuracy_score = predictionAccuracy;
      }
    }

    const { error } = await supabase
      .from("decision_ledger")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchDecisions();
    }
    setUpdatingId(null);
  };

  const activeDecisions = decisions.filter(d => d.decision_status !== "rejected" && d.execution_status !== "completed");
  const completedDecisions = decisions.filter(d => d.execution_status === "completed");

  const avgOutcomeDelta = completedDecisions.length > 0
    ? completedDecisions.reduce((s, d) => s + (d.outcome_delta || 0), 0) / completedDecisions.length
    : null;

  const avgCalibrationError = completedDecisions.filter(d => d.calibration_error !== null).length > 0
    ? completedDecisions.filter(d => d.calibration_error !== null).reduce((s, d) => s + (d.calibration_error || 0), 0)
      / completedDecisions.filter(d => d.calibration_error !== null).length
    : null;

  const avgPredictionAccuracy = completedDecisions.filter(d => d.prediction_accuracy_score !== null).length > 0
    ? completedDecisions.filter(d => d.prediction_accuracy_score !== null).reduce((s, d) => s + (d.prediction_accuracy_score || 0), 0)
      / completedDecisions.filter(d => d.prediction_accuracy_score !== null).length
    : null;

  const decisionSuccessRate = completedDecisions.length > 0
    ? (completedDecisions.filter(d => (d.outcome_delta || 0) > 0).length / completedDecisions.length * 100)
    : null;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-semibold font-display">Decision Ledger</h1>
            <p className="text-xs text-muted-foreground">Track decisions, measure outcomes, calibrate predictions</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Log Decision
          </Button>
        </header>

        <main className="flex-1 p-8 overflow-auto space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Decisions</p>
                <p className="text-2xl font-bold mt-1">{decisions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold mt-1 text-sky-500">{activeDecisions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold mt-1 text-emerald-500">{completedDecisions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Avg Outcome</p>
                <p className={`text-2xl font-bold mt-1 ${avgOutcomeDelta !== null && avgOutcomeDelta > 0 ? "text-emerald-500" : avgOutcomeDelta !== null && avgOutcomeDelta < 0 ? "text-destructive" : ""}`}>
                  {avgOutcomeDelta !== null ? `${avgOutcomeDelta > 0 ? "+" : ""}${avgOutcomeDelta.toFixed(1)}%` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" /> Calibration Error</p>
                <p className={`text-2xl font-bold mt-1 ${avgCalibrationError !== null && avgCalibrationError < 30 ? "text-emerald-500" : avgCalibrationError !== null && avgCalibrationError > 50 ? "text-destructive" : "text-amber-500"}`}>
                  {avgCalibrationError !== null ? `${avgCalibrationError.toFixed(0)}` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Success Rate</p>
                <p className={`text-2xl font-bold mt-1 ${decisionSuccessRate !== null && decisionSuccessRate > 60 ? "text-emerald-500" : decisionSuccessRate !== null && decisionSuccessRate < 40 ? "text-destructive" : "text-amber-500"}`}>
                  {decisionSuccessRate !== null ? `${decisionSuccessRate.toFixed(0)}%` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Create form */}
          {showCreate && (
            <Card className="border-primary/20">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Log New Decision</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Textarea
                      placeholder="Describe the recommended action..."
                      value={newAction}
                      onChange={e => setNewAction(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strategic">Strategic</SelectItem>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="risk_mitigation">Risk Mitigation</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={createDecision} className="w-full" disabled={!newAction.trim()}>
                      Log Decision
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Decisions list */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active" className="gap-2"><PlayCircle className="w-4 h-4" /> Active ({activeDecisions.length})</TabsTrigger>
              <TabsTrigger value="completed" className="gap-2"><CheckCircle2 className="w-4 h-4" /> Completed ({completedDecisions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3">
              {loading ? (
                <Card><CardContent className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></CardContent></Card>
              ) : activeDecisions.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-16 flex flex-col items-center gap-3">
                  <BookOpen className="w-10 h-10 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No active decisions. Log a decision to start tracking.</p>
                </CardContent></Card>
              ) : activeDecisions.map(d => {
                const sCfg = STATUS_COLORS[d.decision_status] || STATUS_COLORS.pending;
                const eCfg = EXEC_STATUS[d.execution_status] || EXEC_STATUS.not_started;
                return (
                  <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className="text-xs capitalize">{d.decision_type.replace(/_/g, " ")}</Badge>
                              <Badge className={`${sCfg.bg} ${sCfg.text} border-none text-xs`}>{sCfg.label}</Badge>
                              <Badge className={`${eCfg.bg} ${eCfg.text} border-none text-xs`}>{eCfg.label}</Badge>
                              {d.capped_confidence !== null && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1" title={d.confidence_cap_reason || undefined}>
                                  <BarChart3 className="w-3 h-3" /> {d.capped_confidence}% conf.
                                  {d.raw_confidence !== null && d.raw_confidence !== d.capped_confidence && (
                                    <span className="text-[10px] opacity-60">(raw: {d.raw_confidence}%)</span>
                                  )}
                                </span>
                              )}
                              {!d.capped_confidence && d.confidence_at_decision && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <BarChart3 className="w-3 h-3" /> {d.confidence_at_decision}% conf.
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium">{d.recommended_action}</p>
                            {d.chosen_action && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" /> Chosen: {d.chosen_action}
                              </p>
                            )}
                            {d.confidence_cap_reason && (
                              <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> {d.confidence_cap_reason}
                              </p>
                            )}
                            {d.notes && <p className="text-xs text-muted-foreground mt-1 italic">{d.notes}</p>}
                            <p className="text-xs text-muted-foreground mt-2">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {new Date(d.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            {d.decision_status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => updateDecision(d.id, { decision_status: "approved", decided_at: new Date().toISOString() })} disabled={updatingId === d.id}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateDecision(d.id, { decision_status: "rejected" })} disabled={updatingId === d.id}>
                                  Reject
                                </Button>
                              </>
                            )}
                            {d.decision_status === "approved" && d.execution_status === "not_started" && (
                              <Button size="sm" variant="outline" onClick={() => updateDecision(d.id, { execution_status: "in_progress", execution_started_at: new Date().toISOString() })} disabled={updatingId === d.id}>
                                <PlayCircle className="w-3 h-3 mr-1" /> Start
                              </Button>
                            )}
                            {d.execution_status === "in_progress" && (
                              <Button size="sm" variant="outline" onClick={() => updateDecision(d.id, { execution_status: "completed", execution_completed_at: new Date().toISOString() })} disabled={updatingId === d.id}>
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3">
              {completedDecisions.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-16 flex flex-col items-center gap-3">
                  <Target className="w-10 h-10 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No completed decisions yet.</p>
                </CardContent></Card>
              ) : completedDecisions.map(d => (
                <Card key={d.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{d.decision_type.replace(/_/g, " ")}</Badge>
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-xs">Completed</Badge>
                          {d.outcome_delta !== null && (
                            <Badge className={`border-none text-xs ${d.outcome_delta >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}`}>
                              {d.outcome_delta >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                              {d.outcome_delta > 0 ? "+" : ""}{d.outcome_delta}% delta
                            </Badge>
                          )}
                          {d.prediction_accuracy_score !== null && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <ShieldCheck className="w-3 h-3" /> Accuracy: {Number(d.prediction_accuracy_score).toFixed(0)}%
                            </Badge>
                          )}
                          {d.calibration_error !== null && (
                            <Badge variant="outline" className={`text-xs gap-1 ${Number(d.calibration_error) > 50 ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-500"}`}>
                              <Activity className="w-3 h-3" /> Cal. Error: {Number(d.calibration_error).toFixed(0)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{d.recommended_action}</p>
                        {d.chosen_action && <p className="text-xs text-muted-foreground mt-1">Chosen: {d.chosen_action}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          {d.raw_confidence !== null && <span>Raw conf: {Number(d.raw_confidence).toFixed(0)}%</span>}
                          {d.capped_confidence !== null && <span>Capped conf: {Number(d.capped_confidence).toFixed(0)}%</span>}
                          {d.confidence_at_decision && !d.capped_confidence && <span>Initial conf: {d.confidence_at_decision}%</span>}
                          {d.confidence_updated && <span>Updated conf: {d.confidence_updated}%</span>}
                          {d.baseline_value !== null && <span>Baseline: {d.baseline_value}</span>}
                          {d.actual_value !== null && <span>Actual: {d.actual_value}</span>}
                        </div>
                        {d.confidence_cap_reason && (
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{d.confidence_cap_reason}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default DecisionLedgerPage;
