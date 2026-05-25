import { useMemo } from "react";
import { useExecutiveIntelligence, type Intervention } from "@/hooks/useExecutiveIntelligence";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IntelligenceDisclaimer from "@/components/IntelligenceDisclaimer";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import {
  AlertTriangle, ShieldAlert, Activity, Compass, Sparkles,
  Globe, GitBranch, Zap, CheckCircle2, ArrowUpRight, Clock,
} from "lucide-react";

const TIER_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  informational: "outline", low: "outline", elevated: "secondary", high: "default", critical: "destructive",
};

const TIER_LABEL: Record<string, string> = {
  informational: "Info", low: "Low", elevated: "Elevated", high: "High", critical: "Critical",
};

function ExecutiveBriefCard({ brief, onRegenerate, generating }: {
  brief: ReturnType<typeof useExecutiveIntelligence>["brief"];
  onRegenerate: () => void;
  generating: boolean;
}) {
  if (!brief) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Executive Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">No brief generated yet for this organization.</p>
          <Button onClick={onRegenerate} disabled={generating}>{generating ? "Generating…" : "Generate brief"}</Button>
        </CardContent>
      </Card>
    );
  }
  const s = brief.summary_json;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Executive Brief</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Generated: {new Date(brief.generated_at).toLocaleString()} · Confidence: {s.confidence}% · Risk: {brief.risk_score ?? 0}/100
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={generating}>
          {generating ? "Regenerating…" : "Regenerate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{s.headline}</h3>
          {s.escalation_recommended && (
            <Badge variant="destructive" className="mt-2"><AlertTriangle className="h-3 w-3 mr-1" /> Escalation recommended</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="font-medium">Why it matters:</span> <span className="text-muted-foreground">{s.why_it_matters}</span></div>
          <div><span className="font-medium">Likely impact:</span> <span className="text-muted-foreground">{s.likely_business_impact}</span></div>
          <div><span className="font-medium">Affected areas:</span> <span className="text-muted-foreground">{s.affected_areas.join(", ") || "—"}</span></div>
          <div><span className="font-medium">Time horizon:</span> <span className="text-muted-foreground">{s.projected_time_horizon_days} days</span></div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Recommended executive actions</h4>
          <ul className="space-y-1.5">
            {s.recommended_executive_actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge variant={TIER_VARIANT[a.label.toLowerCase()] ?? "secondary"} className="shrink-0">{a.label}</Badge>
                <span className="text-muted-foreground">{a.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground border-t pt-3">
          <span>Critical: {s.pressure_tiers.critical}</span>
          <span>High: {s.pressure_tiers.high}</span>
          <span>Elevated: {s.pressure_tiers.elevated}</span>
          <span className="ml-auto">Sources: {(s.provenance?.items_evaluated as number) ?? 0} signals, {(s.provenance?.advisories_considered as number) ?? 0} advisories</span>
        </div>
      </CardContent>
    </Card>
  );
}

function InterventionRow({ iv, onUpdate }: { iv: Intervention; onUpdate: (id: string, p: any) => void }) {
  const resolved = !!iv.resolved_at;
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={TIER_VARIANT[iv.escalation_tier]}>{TIER_LABEL[iv.escalation_tier]} · {iv.decision_pressure_score}</Badge>
          <Badge variant="outline">{iv.intervention_type}</Badge>
          <Badge variant="secondary">{iv.status}</Badge>
          {resolved && <Badge variant="outline" className="text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Resolved</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{new Date(iv.created_at).toLocaleString()}</span>
      </div>
      <p className="text-sm font-medium">{iv.recommended_action}</p>
      {iv.rationale && <p className="text-xs text-muted-foreground">{iv.rationale}</p>}
      {!resolved && (
        <div className="flex gap-2 flex-wrap pt-1">
          {iv.status !== "acknowledged" && (
            <Button size="sm" variant="outline" onClick={() => onUpdate(iv.id, { status: "acknowledged", acknowledged: true })}>
              Acknowledge
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onUpdate(iv.id, { status: "deferred" })}>Defer</Button>
          <Button size="sm" variant="outline" onClick={() => onUpdate(iv.id, { status: "escalated" })}>Escalate</Button>
          <Button size="sm" variant="outline" onClick={() => onUpdate(iv.id, { status: "converted" })}>Convert to decision</Button>
          <Button size="sm" onClick={() => onUpdate(iv.id, { status: "resolved", resolved: true })}>
            Mark resolved
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ExecutiveIntelligence() {
  const { orgRole, isLoading: roleLoading } = usePermissions();
  const {
    brief, interventions, topByPressure, narratives, exposure, observability, snapshot,
    loading, generating, regenerate, updateIntervention,
  } = useExecutiveIntelligence();


  const allowed = useMemo(
    () => orgRole && ["owner", "admin", "executive"].includes(orgRole),
    [orgRole]
  );

  if (roleLoading) {
    return <div className="container mx-auto p-6"><Card><CardContent className="p-6">Loading…</CardContent></Card></div>;
  }
  if (!allowed) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader><CardTitle>Restricted</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Executive Intelligence is restricted to owner, admin, and executive roles.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pressureQueue = topByPressure.filter((i) => !i.resolved_at);
  const emergingThreats = pressureQueue.filter((i) => i.escalation_tier === "high" || i.escalation_tier === "critical").slice(0, 8);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            Executive Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Prioritized intelligence, decision pressure, and recommended interventions.
          </p>
        </div>
        {observability && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <Card><CardContent className="p-2.5"><div className="text-muted-foreground">Conversion</div><div className="text-lg font-semibold">{observability.items_to_decision_rate}%</div></CardContent></Card>
            <Card><CardContent className="p-2.5"><div className="text-muted-foreground">Resolution</div><div className="text-lg font-semibold">{observability.intervention_resolution_rate}%</div></CardContent></Card>
            <Card><CardContent className="p-2.5"><div className="text-muted-foreground">Unresolved critical</div><div className="text-lg font-semibold">{observability.unresolved_critical_pressure}</div></CardContent></Card>
            <Card><CardContent className="p-2.5"><div className="text-muted-foreground">Avg latency</div><div className="text-lg font-semibold">{observability.avg_response_latency_hours}h</div></CardContent></Card>
            <Card><CardContent className="p-2.5"><div className="text-muted-foreground">Advisory adoption</div><div className="text-lg font-semibold">{observability.advisory_adoption_rate}%</div></CardContent></Card>
            <Card><CardContent className="p-2.5"><div className="text-muted-foreground">Memory effectiveness</div><div className="text-lg font-semibold">{observability.memory_effectiveness_score}/100</div></CardContent></Card>
          </div>
        )}
      </header>

      <IntelligenceDisclaimer />

      <SectionErrorBoundary sectionName="Executive Brief">
        <ExecutiveBriefCard brief={brief} onRegenerate={regenerate} generating={generating} />
      </SectionErrorBoundary>

      <Tabs defaultValue="pressure">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pressure"><Zap className="h-4 w-4 mr-1.5" /> Pressure Queue</TabsTrigger>
          <TabsTrigger value="threats"><AlertTriangle className="h-4 w-4 mr-1.5" /> Emerging Threats</TabsTrigger>
          <TabsTrigger value="interventions"><Activity className="h-4 w-4 mr-1.5" /> Interventions</TabsTrigger>
          <TabsTrigger value="narratives"><GitBranch className="h-4 w-4 mr-1.5" /> Cross-Domain</TabsTrigger>
          <TabsTrigger value="exposure"><Globe className="h-4 w-4 mr-1.5" /> Exposure</TabsTrigger>
          <TabsTrigger value="forecasts"><Compass className="h-4 w-4 mr-1.5" /> Forecasts</TabsTrigger>
        </TabsList>

        <TabsContent value="pressure" className="mt-4">
          <SectionErrorBoundary sectionName="Decision Pressure Queue">
            <Card>
              <CardHeader><CardTitle>Decision Pressure Queue</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : pressureQueue.length === 0 ? (
                  <p className="text-muted-foreground">No active pressure. Generate a brief to populate interventions.</p>
                ) : (
                  pressureQueue.slice(0, 20).map((iv) => (
                    <InterventionRow key={iv.id} iv={iv} onUpdate={updateIntervention} />
                  ))
                )}
              </CardContent>
            </Card>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="threats" className="mt-4">
          <SectionErrorBoundary sectionName="Emerging Threats">
            <Card>
              <CardHeader><CardTitle>Emerging Threats Timeline</CardTitle></CardHeader>
              <CardContent>
                {emergingThreats.length === 0 ? (
                  <p className="text-muted-foreground">No emerging threats above high tier.</p>
                ) : (
                  <ol className="border-l-2 border-border ml-2 space-y-4">
                    {emergingThreats.map((iv) => (
                      <li key={iv.id} className="pl-4 relative">
                        <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-primary" />
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={TIER_VARIANT[iv.escalation_tier]}>{TIER_LABEL[iv.escalation_tier]}</Badge>
                          <Badge variant="outline">{iv.intervention_type}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(iv.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm">{iv.recommended_action}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="interventions" className="mt-4">
          <SectionErrorBoundary sectionName="Recommended Interventions">
            <Card>
              <CardHeader><CardTitle>Recommended Interventions ({interventions.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {interventions.length === 0 ? (
                  <p className="text-muted-foreground">No interventions yet.</p>
                ) : (
                  interventions.map((iv) => <InterventionRow key={iv.id} iv={iv} onUpdate={updateIntervention} />)
                )}
              </CardContent>
            </Card>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="narratives" className="mt-4">
          <SectionErrorBoundary sectionName="Cross-Domain Narratives">
            <Card>
              <CardHeader><CardTitle>Cross-Domain Risk Narratives</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {narratives.length === 0 ? (
                  <p className="text-muted-foreground">No multi-domain pressure detected.</p>
                ) : (
                  narratives.map((n) => (
                    <div key={n.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">Strength: {n.narrative_strength}/100</Badge>
                        <Badge variant="outline">Pressure: {n.combined_pressure_score}/100</Badge>
                        {n.projected_window_days && <Badge variant="outline">Window: {n.projected_window_days}d</Badge>}
                        {n.affected_domains.map((d) => <Badge key={d} variant="outline">{d}</Badge>)}
                      </div>
                      <p className="text-sm">{n.narrative}</p>
                      <p className="text-xs text-muted-foreground">{new Date(n.generated_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="exposure" className="mt-4">
          <SectionErrorBoundary sectionName="Organization Exposure">
            <Card>
              <CardHeader><CardTitle>Organization Exposure</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!exposure ? (
                  <p className="text-muted-foreground">No exposure snapshot yet.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Exposure score</span>
                        <span className="text-muted-foreground">{exposure.exposure_score}/100</span>
                      </div>
                      <Progress value={exposure.exposure_score} />
                      {exposure.exposure_reasoning && <p className="text-xs text-muted-foreground">{exposure.exposure_reasoning}</p>}
                    </div>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Top geographies</h4>
                        <ul className="space-y-1 text-xs">
                          {Object.entries(exposure.geography_exposure).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, c]) => (
                            <li key={g} className="flex justify-between"><span>{g}</span><span className="text-muted-foreground">{c}</span></li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Top entities</h4>
                        <ul className="space-y-1 text-xs">
                          {Object.entries(exposure.entity_exposure).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e, c]) => (
                            <li key={e} className="flex justify-between"><span className="truncate">{e}</span><span className="text-muted-foreground">{c}</span></li>
                          ))}
                          {Object.keys(exposure.entity_exposure).length === 0 && <li className="text-muted-foreground">—</li>}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Sector exposure</h4>
                        <ul className="space-y-1 text-xs">
                          {Object.entries(exposure.sector_exposure).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, c]) => (
                            <li key={s} className="flex justify-between"><span>{s}</span><span className="text-muted-foreground">{c}</span></li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Computed: {new Date(exposure.computed_at).toLocaleString()}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="forecasts" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Strategic Forecasts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {brief ? (
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Projected horizon:</span> {brief.summary_json.projected_time_horizon_days} days</p>
                  <p><span className="font-medium">Likely impact:</span> {brief.summary_json.likely_business_impact}</p>
                  <p><span className="font-medium">Confidence:</span> {brief.summary_json.confidence}% <span className="text-muted-foreground">(capped at 85%)</span></p>
                  <Button variant="outline" size="sm" asChild className="mt-2">
                    <a href="/forecasting">Open Forecasting <ArrowUpRight className="h-3 w-3 ml-1" /></a>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Generate a brief to see strategic forecasts.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
