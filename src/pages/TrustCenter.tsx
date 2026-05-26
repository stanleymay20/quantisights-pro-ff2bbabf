import { Shield, Brain, Database, Eye, Lock, GitBranch, CheckCircle2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import AttestedEvidence from "@/components/security/AttestedEvidence";
import LiveTrustMetrics from "@/components/security/LiveTrustMetrics";
import ProcurementReadinessChecklist from "@/components/security/ProcurementReadinessChecklist";
import DownloadProcurementPack from "@/components/security/DownloadProcurementPack";

const sections = [
  {
    icon: Brain,
    title: "How Quantivis Makes Decisions",
    badge: "Deterministic + AI",
    content: [
      "Every recommendation follows a three-layer architecture: statistical analysis first, heuristic scoring second, AI narrative generation third.",
      "The statistical layer uses pure-function implementations (K-Means clustering, Isolation Forest anomaly detection, Holt's exponential smoothing) — no stochastic model dependency.",
      "AI (LLM) is used only for natural language generation — never for core scoring or classification. All numbers are deterministic.",
      "Confidence scores are capped by data volume: <12 data points → max 60%, <30 → max 75%, 30+ → max 90%. This prevents overconfidence from small samples.",
    ],
  },
  {
    icon: Eye,
    title: "Auditability & Traceability",
    badge: "Full Lineage",
    content: [
      "Every insight, advisory, and decision is assigned an Evidence Classification: OBSERVED_FACT, STATISTICAL_INFERENCE, HEURISTIC_ESTIMATE, or AI_RECOMMENDATION.",
      "The Decision Ledger is an immutable audit trail — every approval, dismissal, and modification is timestamped with actor identity and rationale.",
      "Data lineage tracks every metric from raw ingestion → transformation → aggregation → insight, viewable in the Lineage Explorer.",
      "The audit_log table is write-once with database-level DENY policies on UPDATE and DELETE — ensuring untamperable records.",
    ],
  },
  {
    icon: GitBranch,
    title: "Model Transparency",
    badge: "Open Box",
    content: [
      "Bayesian calibration runs every 12 hours, comparing predicted confidence against actual outcomes across confidence bands.",
      "Calibration corrections are versioned (model_version) with full band-level sample sizes, corrections, and bias direction recorded.",
      "The Calibration Curve and Decision Accuracy Dashboard provide visual proof of prediction quality over time.",
      "All AI-generated narratives include a Confidence Honesty layer — tooltips detailing what drives and limits each score.",
    ],
  },
  {
    icon: Database,
    title: "Data Handling & Isolation",
    badge: "DSGVO-compliant",
    content: [
      "All data is scoped by organization_id — enforced at the database level via Row Level Security (RLS) on 100% of tables.",
      "Data encryption at rest (AES-256) and in transit (TLS 1.3). No data leaves the EU processing region.",
      "AI redaction is available — sensitive fields can be excluded from LLM context before generation.",
      "Data retention policies are configurable per category with automated cleanup cycles.",
    ],
  },
  {
    icon: Lock,
    title: "Security Posture",
    badge: "Enterprise-grade",
    content: [
      "Multi-factor authentication (MFA) with TOTP and WebAuthn/Passkey support.",
      "SSO integration via SAML 2.0 with enforced domain-level SSO policies.",
      "Session management with configurable timeout, concurrent session limits, and login anomaly detection.",
      "Rate limiting on all API endpoints with automated abuse detection.",
    ],
  },
  {
    icon: CheckCircle2,
    title: "Operational Integrity",
    badge: "Autonomous",
    content: [
      "7 autonomous orchestration jobs maintain system health: outcome evaluation (6h), calibration (12h), staleness checks (4h), retention cleanup (daily), morning briefs (daily), convergence reconciliation (6h), and health probes (5min).",
      "All jobs are protected by advisory locks (pg_advisory_lock) to prevent concurrent execution overlap.",
      "Every job run is logged to cron_run_log with status, duration, error messages, and metadata for full observability.",
      "The System Health dashboard provides real-time visibility into pipeline status, closed-loop rates, and job health.",
    ],
  },
];

const TrustCenter = () => {
  const navigate = useNavigate();

  return (
    <SectionErrorBoundary sectionName="Trust Center">
      <div className="space-y-8 max-w-4xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold font-display">Trust Center</h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            Quantivis is built for enterprises that require provable, auditable intelligence. Every claim on this page
            is anchored to real operational evidence — daily snapshots, immutable hashes, and per-metric provenance.
          </p>
        </div>

        {/* Evidence-backed live metrics */}
        <LiveTrustMetrics />

        {/* Evidence-derived procurement readiness */}
        <ProcurementReadinessChecklist />

        {/* Procurement pack download */}
        <Card className="border-border/50">
          <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">Procurement Pack</h2>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                Versioned ZIP bundle — DPA, TOMs, AI Governance, Incident Response, Auditability, Security Overview,
                Sub-processor Registry, AI Usage Transparency, and the current Trust Snapshot. Includes sha256 manifest
                and bundle integrity ID.
              </p>
            </div>
            <DownloadProcurementPack />
          </CardContent>
        </Card>

        <Separator />

        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.title} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <section.icon className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{section.badge}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {section.content.map((point, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                      <span className="text-primary/50 mt-1 shrink-0">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        <AttestedEvidence />

        <Separator />

        <div>
          <h2 className="text-lg font-semibold mb-3">Procurement &amp; Compliance Documents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { path: "/toms", label: "Technical & Organizational Measures", desc: "GDPR Art. 32 control catalogue (TOMs / AVV annex)" },
              { path: "/ai-governance", label: "AI Governance", desc: "EU AI Act alignment, human oversight, explainability" },
              { path: "/ai-system-classification", label: "AI System Classification", desc: "EU AI Act risk matrix per capability" },
              { path: "/how-ai-is-used", label: "How AI Is Used", desc: "Deterministic / statistical / AI / human / autonomous boundary" },
              { path: "/auditability", label: "Auditability", desc: "Audit log, lineage, decision ledger, calibration history" },
              { path: "/incident-response", label: "Incident Response", desc: "Severity SLAs, GDPR Art. 33 notification, runbook" },
              { path: "/security-overview", label: "Security Overview", desc: "Auth, RBAC, isolation, secrets, breakers, DLQ" },
              { path: "/security-policy", label: "Vulnerability Disclosure", desc: "Reporting channels, SLAs, scope, safe harbour" },
              { path: "/subprocessors", label: "Sub-processor Registry", desc: "Live DB-backed registry with DPA + transfer mechanism" },
              { path: "/dpa", label: "Data Processing Agreement", desc: "DPA / AVV template available on request" },
              { path: "/security-questionnaire", label: "Security Questionnaire", desc: "Standard pre-filled procurement Q&A" },
              { path: "/data-retention", label: "Data Retention Policy", desc: "Category-level retention and erasure" },
            ].map((doc) => (
              <Card
                key={doc.path}
                className="border-border/50 hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => navigate(doc.path)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{doc.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{doc.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/system-health")}>
            <FileText className="w-3.5 h-3.5 mr-1.5" /> System Health
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/decision-accuracy")}>
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Decision Accuracy
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/lineage")}>
            <GitBranch className="w-3.5 h-3.5 mr-1.5" /> Data Lineage
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/security")}>
            <Lock className="w-3.5 h-3.5 mr-1.5" /> Security
          </Button>
        </div>
      </div>
    </SectionErrorBoundary>
  );
};

export default TrustCenter;
