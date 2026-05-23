/**
 * Centralised route configuration.
 * Each entry maps a path to a lazy-loaded component and a layout wrapper.
 *
 * Layout keys:
 *   "public"   → SafeRoute only (no auth)
 *   "full"     → P  (sidebar + context bar)
 *   "minimal"  → PMinimal (no sidebar)
 *   "none"     → bare component (e.g. Index)
 */

import { lazy } from "react";

// Eager: critical-path landing
import Index from "@/pages/Index";

// ── Auth ──
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

// ── Intelligence Core ──
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const KPIs = lazy(() => import("@/pages/KPIs"));
const Diagnostics = lazy(() => import("@/pages/Diagnostics"));
const Advisory = lazy(() => import("@/pages/Advisory"));
const Forecasting = lazy(() => import("@/pages/Forecasting"));
const NaturalLanguageQuery = lazy(() => import("@/pages/NaturalLanguageQuery"));
const MarketIntelligence = lazy(() => import("@/pages/MarketIntelligence"));

// ── Decision System ──
const DecisionLedger = lazy(() => import("@/pages/DecisionLedger"));
const DecisionIntelligence = lazy(() => import("@/pages/DecisionIntelligence"));
const DecisionFitness = lazy(() => import("@/pages/DecisionFitness"));
const ExecutionDashboard = lazy(() => import("@/pages/ExecutionDashboard"));
const CognitiveBiasDetection = lazy(() => import("@/pages/CognitiveBiasDetection"));
const CounterfactualExplanation = lazy(() => import("@/pages/CounterfactualExplanation"));
const CausalInference = lazy(() => import("@/pages/CausalInference"));
const CalibrationAssessment = lazy(() => import("@/pages/CalibrationAssessment"));
const Misses = lazy(() => import("@/pages/Misses"));
const DecisionAccuracy = lazy(() => import("@/pages/DecisionAccuracy"));
const Outcomes = lazy(() => import("@/pages/Outcomes"));
const DecisionHistory = lazy(() => import("@/pages/DecisionHistory"));
const DecisionRules = lazy(() => import("@/pages/DecisionRules"));

// ── Scenarios & Simulations ──
const Scenarios = lazy(() => import("@/pages/Scenarios"));
const Simulations = lazy(() => import("@/pages/Simulations"));
const ScenarioBranching = lazy(() => import("@/pages/ScenarioBranching"));

// ── Data Platform ──
const DataUpload = lazy(() => import("@/pages/DataUpload"));
const DataConnectors = lazy(() => import("@/pages/DataConnectors"));
const DataSources = lazy(() => import("@/pages/DataSources"));
const DatasetExplorer = lazy(() => import("@/pages/DatasetExplorer"));
const DataCatalog = lazy(() => import("@/pages/DataCatalog"));
const DataLineage = lazy(() => import("@/pages/DataLineage"));
const PipelineObservability = lazy(() => import("@/pages/PipelineObservability"));
const DataHub = lazy(() => import("@/pages/DataHub"));

// ── Reporting & Strategy ──
const Reports = lazy(() => import("@/pages/Reports"));
const BoardReport = lazy(() => import("@/pages/BoardReport"));
const Executive = lazy(() => import("@/pages/Executive"));
const StrategyPack = lazy(() => import("@/pages/StrategyPack"));
const Benchmarking = lazy(() => import("@/pages/Benchmarking"));
const OKRs = lazy(() => import("@/pages/OKRs"));
const Portfolio = lazy(() => import("@/pages/Portfolio"));

// ── Governance & Compliance ──
const GovernanceCommandView = lazy(() => import("@/pages/GovernanceCommandView"));
const GovernanceMaturity = lazy(() => import("@/pages/GovernanceMaturity"));
const Compliance = lazy(() => import("@/pages/Compliance"));
const AlertPlaybooks = lazy(() => import("@/pages/AlertPlaybooks"));
const SystemHealth = lazy(() => import("@/pages/SystemHealth"));
const TrustCenter = lazy(() => import("@/pages/TrustCenter"));
const FairnessObservability = lazy(() => import("@/pages/FairnessObservability"));
const DecisionMaturity = lazy(() => import("@/pages/DecisionMaturity"));

// ── Organization & Admin ──
const Team = lazy(() => import("@/pages/Team"));
const Clients = lazy(() => import("@/pages/Clients"));
const Settings = lazy(() => import("@/pages/Settings"));
const Billing = lazy(() => import("@/pages/Billing"));
const SSOConfig = lazy(() => import("@/pages/SSOConfig"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const PrivacyDashboard = lazy(() => import("@/pages/PrivacyDashboard"));

// ── Public / Marketing ──
const Pricing = lazy(() => import("@/pages/Pricing"));
const Demo = lazy(() => import("@/pages/Demo"));
const Security = lazy(() => import("@/pages/Security"));
const SecurityQuestionnaire = lazy(() => import("@/pages/SecurityQuestionnaire"));
const Documentation = lazy(() => import("@/pages/Documentation"));
const APIDocs = lazy(() => import("@/pages/APIDocs"));
const BusinessModel = lazy(() => import("@/pages/BusinessModel"));
const FounderHandbook = lazy(() => import("@/pages/FounderHandbook"));
const WhyVsMicrosoft = lazy(() => import("@/pages/WhyVsMicrosoft"));
const Pitch = lazy(() => import("@/pages/Pitch"));
const Competitions = lazy(() => import("@/pages/Competitions"));
const PitchDeck = lazy(() => import("@/pages/PitchDeck"));
const Ebook = lazy(() => import("@/pages/Ebook"));
const FreeAnalysis = lazy(() => import("@/pages/FreeAnalysis"));
const EmbedDashboard = lazy(() => import("@/pages/EmbedDashboard"));
const PilotAudit = lazy(() => import("@/pages/PilotAudit"));
const SystemStatus = lazy(() => import("@/pages/SystemStatus"));
const SLA = lazy(() => import("@/pages/SLA"));
const Compare = lazy(() => import("@/pages/Compare"));
const EnterpriseContact = lazy(() => import("@/pages/EnterpriseContact"));
const DataVendors = lazy(() => import("@/pages/admin/DataVendors"));
const InternalData = lazy(() => import("@/pages/admin/InternalData"));
const AdminConnectors = lazy(() => import("@/pages/admin/Connectors"));
const IngestionObservability = lazy(() => import("@/pages/admin/IngestionObservability"));
const AicisSync = lazy(() => import("@/pages/admin/AicisSync"));
const BridgeHealth = lazy(() => import("@/pages/admin/BridgeHealth"));
const CompetitiveAnalysis = lazy(() => import("@/pages/CompetitiveAnalysis"));
const IntelligenceDashboard = lazy(() => import("@/pages/IntelligenceDashboard"));
const IntelligenceInbox = lazy(() => import("@/pages/IntelligenceInbox"));
const ExecutiveIntelligence = lazy(() => import("@/pages/ExecutiveIntelligence"));

// ── Legal ──
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const CookiePolicy = lazy(() => import("@/pages/CookiePolicy"));
const DataProcessing = lazy(() => import("@/pages/DataProcessing"));
const DataRetention = lazy(() => import("@/pages/DataRetention"));
const Subprocessors = lazy(() => import("@/pages/Subprocessors"));
const Impressum = lazy(() => import("@/pages/Impressum"));

const NotFound = lazy(() => import("@/pages/NotFound"));

export type RouteLayout = "none" | "public" | "full" | "minimal";

export interface RouteEntry {
  path: string;
  element: React.ReactNode;
  layout: RouteLayout;
}

export const routes: RouteEntry[] = [
  // ══════ Landing ══════
  { path: "/", element: <Index />, layout: "none" },

  // ══════ Auth ══════
  { path: "/login", element: <Login />, layout: "public" },
  { path: "/register", element: <Register />, layout: "public" },
  { path: "/forgot-password", element: <ForgotPassword />, layout: "public" },
  { path: "/reset-password", element: <ResetPassword />, layout: "public" },
  { path: "/accept-invite", element: <AcceptInvite />, layout: "public" },

  // ══════ Public ══════
  { path: "/demo", element: <Demo />, layout: "public" },
  { path: "/embed", element: <EmbedDashboard />, layout: "public" },
  { path: "/pricing", element: <Pricing />, layout: "public" },
  { path: "/calibration", element: <CalibrationAssessment />, layout: "public" },
  { path: "/free-analysis", element: <FreeAnalysis />, layout: "public" },
  { path: "/status", element: <SystemStatus />, layout: "public" },
  { path: "/sla", element: <SLA />, layout: "public" },

  // ══════ Marketing / Trust / Comparison ══════
  { path: "/compare", element: <Compare />, layout: "public" },
  { path: "/business-model", element: <BusinessModel />, layout: "public" },
  { path: "/security", element: <Security />, layout: "public" },
  { path: "/security-questionnaire", element: <SecurityQuestionnaire />, layout: "public" },
  { path: "/handbook", element: <FounderHandbook />, layout: "public" },
  { path: "/vs/microsoft", element: <WhyVsMicrosoft />, layout: "public" },
  { path: "/pitch", element: <Pitch />, layout: "public" },
  { path: "/competitions", element: <Competitions />, layout: "public" },
  { path: "/pitch-deck", element: <PitchDeck />, layout: "public" },
  { path: "/ebook", element: <Ebook />, layout: "public" },
  { path: "/enterprise/contact", element: <EnterpriseContact />, layout: "public" },
  { path: "/competitive-analysis", element: <CompetitiveAnalysis />, layout: "public" },

  // ══════ Legal ══════
  { path: "/terms", element: <Terms />, layout: "public" },
  { path: "/privacy", element: <Privacy />, layout: "public" },
  { path: "/cookies", element: <CookiePolicy />, layout: "public" },
  { path: "/dpa", element: <DataProcessing />, layout: "public" },
  { path: "/data-retention", element: <DataRetention />, layout: "public" },
  { path: "/subprocessors", element: <Subprocessors />, layout: "public" },
  { path: "/impressum", element: <Impressum />, layout: "public" },

  // ══════ Standalone protected (no sidebar) ══════
  { path: "/onboarding", element: <Onboarding />, layout: "minimal" },
  { path: "/board-report", element: <BoardReport />, layout: "minimal" },

  // ══════ Intelligence Core ══════
  { path: "/dashboard", element: <Dashboard />, layout: "full" },
  { path: "/kpis", element: <KPIs />, layout: "full" },
  { path: "/diagnostics", element: <Diagnostics />, layout: "full" },
  { path: "/advisory", element: <Advisory />, layout: "full" },
  { path: "/forecasting", element: <Forecasting />, layout: "full" },
  { path: "/ask", element: <NaturalLanguageQuery />, layout: "full" },
  { path: "/market-intelligence", element: <MarketIntelligence />, layout: "full" },
  { path: "/intelligence-dashboard", element: <IntelligenceDashboard />, layout: "full" },
  { path: "/intelligence-inbox", element: <IntelligenceInbox />, layout: "full" },
  { path: "/executive-intelligence", element: <ExecutiveIntelligence />, layout: "full" },

  // ══════ Decision System ══════
  { path: "/decisions", element: <DecisionLedger />, layout: "full" },
  { path: "/decision-intelligence", element: <DecisionIntelligence />, layout: "full" },
  { path: "/decision-fitness", element: <DecisionFitness />, layout: "full" },
  { path: "/execution", element: <ExecutionDashboard />, layout: "full" },
  { path: "/cognitive-bias", element: <CognitiveBiasDetection />, layout: "full" },
  { path: "/counterfactual", element: <CounterfactualExplanation />, layout: "full" },
  { path: "/causal-inference", element: <CausalInference />, layout: "full" },
  { path: "/misses", element: <Misses />, layout: "full" },
  { path: "/decision-accuracy", element: <DecisionAccuracy />, layout: "full" },
  { path: "/outcomes", element: <Outcomes />, layout: "full" },
  { path: "/history", element: <DecisionHistory />, layout: "full" },
  { path: "/decision-rules", element: <DecisionRules />, layout: "full" },

  // ══════ Scenarios & Simulations ══════
  { path: "/scenarios", element: <Scenarios />, layout: "full" },
  { path: "/simulations", element: <Simulations />, layout: "full" },
  { path: "/branching", element: <ScenarioBranching />, layout: "full" },

  // ══════ Data Platform ══════
  { path: "/data-upload", element: <DataUpload />, layout: "full" },
  { path: "/data-sources", element: <DataSources />, layout: "full" },
  { path: "/data-connectors", element: <DataConnectors />, layout: "full" },
  { path: "/dataset-explorer", element: <DatasetExplorer />, layout: "full" },
  { path: "/data-catalog", element: <DataCatalog />, layout: "full" },
  { path: "/lineage", element: <DataLineage />, layout: "full" },
  { path: "/pipeline", element: <PipelineObservability />, layout: "full" },
  { path: "/data-hub", element: <DataHub />, layout: "full" },
  { path: "/aicis-sync", element: <AicisSync />, layout: "full" },
  { path: "/admin/bridge-health", element: <BridgeHealth />, layout: "full" },

  // ══════ Reporting & Strategy ══════
  { path: "/reports", element: <Reports />, layout: "full" },
  { path: "/executive", element: <Executive />, layout: "full" },
  { path: "/strategy-pack", element: <StrategyPack />, layout: "full" },
  { path: "/benchmarking", element: <Benchmarking />, layout: "full" },
  { path: "/okrs", element: <OKRs />, layout: "full" },
  { path: "/portfolio", element: <Portfolio />, layout: "full" },

  // ══════ Governance & Compliance ══════
  { path: "/governance", element: <GovernanceCommandView />, layout: "full" },
  { path: "/governance-maturity", element: <GovernanceMaturity />, layout: "full" },
  { path: "/compliance", element: <Compliance />, layout: "full" },
  { path: "/alert-playbooks", element: <AlertPlaybooks />, layout: "full" },
  { path: "/system-health", element: <SystemHealth />, layout: "full" },
  { path: "/trust-center", element: <TrustCenter />, layout: "full" },
  { path: "/fairness", element: <FairnessObservability />, layout: "full" },
  { path: "/decision-maturity", element: <DecisionMaturity />, layout: "full" },

  // ══════ Organization & Admin ══════
  { path: "/team", element: <Team />, layout: "full" },
  { path: "/clients", element: <Clients />, layout: "full" },
  { path: "/billing", element: <Billing />, layout: "full" },
  { path: "/settings", element: <Settings />, layout: "full" },
  { path: "/sso", element: <SSOConfig />, layout: "full" },
  { path: "/privacy-dashboard", element: <PrivacyDashboard />, layout: "full" },
  { path: "/docs", element: <Documentation />, layout: "full" },
  { path: "/api-docs", element: <APIDocs />, layout: "full" },
  { path: "/pilot-audit", element: <PilotAudit />, layout: "full" },
  { path: "/admin/data-vendors", element: <DataVendors />, layout: "full" },
  { path: "/admin/internal-data", element: <InternalData />, layout: "full" },
  { path: "/admin/connectors", element: <AdminConnectors />, layout: "full" },
  { path: "/admin/ingestion-observability", element: <IngestionObservability />, layout: "full" },

  // ══════ Catch-all ══════
  { path: "*", element: <NotFound />, layout: "public" },
];
