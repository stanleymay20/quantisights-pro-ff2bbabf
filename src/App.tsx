import { lazy, Suspense, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { DatasetProvider } from "@/contexts/DatasetContext";
import { SidebarProvider } from "@/components/dashboard/DashboardSidebar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import RouteErrorFallback from "@/components/RouteErrorFallback";
import { ThemeProvider } from "@/components/ThemeProvider";
import ProtectedLayout, { MinimalProtectedLayout } from "@/components/layout/ProtectedLayout";
import CookieConsent from "@/components/CookieConsent";
import SessionTimeout from "@/components/auth/SessionTimeout";

// Eager: landing page (critical path)
import Index from "./pages/Index";

// ═══════════════════════════════════════════════════════
// LAZY IMPORTS — grouped by workflow domain
// ═══════════════════════════════════════════════════════

// ── Auth ──
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// ── Intelligence Core ──
const Dashboard = lazy(() => import("./pages/Dashboard"));
const KPIs = lazy(() => import("./pages/KPIs"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Advisory = lazy(() => import("./pages/Advisory"));
const Forecasting = lazy(() => import("./pages/Forecasting"));
const NaturalLanguageQuery = lazy(() => import("./pages/NaturalLanguageQuery"));
const MarketIntelligence = lazy(() => import("./pages/MarketIntelligence"));

// ── Decision System ──
const DecisionLedger = lazy(() => import("./pages/DecisionLedger"));
const DecisionIntelligence = lazy(() => import("./pages/DecisionIntelligence"));
const DecisionFitness = lazy(() => import("./pages/DecisionFitness"));
const ExecutionDashboard = lazy(() => import("./pages/ExecutionDashboard"));
const CognitiveBiasDetection = lazy(() => import("./pages/CognitiveBiasDetection"));
const CounterfactualExplanation = lazy(() => import("./pages/CounterfactualExplanation"));
const CausalInference = lazy(() => import("./pages/CausalInference"));
const CalibrationAssessment = lazy(() => import("./pages/CalibrationAssessment"));
const Misses = lazy(() => import("./pages/Misses"));
const DecisionAccuracy = lazy(() => import("./pages/DecisionAccuracy"));

// ── Scenarios & Simulations ──
const Scenarios = lazy(() => import("./pages/Scenarios"));
const Simulations = lazy(() => import("./pages/Simulations"));
const ScenarioBranching = lazy(() => import("./pages/ScenarioBranching"));

// ── Data Platform ──
const DataUpload = lazy(() => import("./pages/DataUpload"));
const DataConnectors = lazy(() => import("./pages/DataConnectors"));
const DataSources = lazy(() => import("./pages/DataSources"));
const DatasetExplorer = lazy(() => import("./pages/DatasetExplorer"));
const DataCatalog = lazy(() => import("./pages/DataCatalog"));
const DataLineage = lazy(() => import("./pages/DataLineage"));
const PipelineObservability = lazy(() => import("./pages/PipelineObservability"));

// ── Reporting & Strategy ──
const Reports = lazy(() => import("./pages/Reports"));
const BoardReport = lazy(() => import("./pages/BoardReport"));
const Executive = lazy(() => import("./pages/Executive"));
const StrategyPack = lazy(() => import("./pages/StrategyPack"));
const Benchmarking = lazy(() => import("./pages/Benchmarking"));
const OKRs = lazy(() => import("./pages/OKRs"));
const Portfolio = lazy(() => import("./pages/Portfolio"));

// ── Governance & Compliance ──
const GovernanceCommandView = lazy(() => import("./pages/GovernanceCommandView"));
const GovernanceMaturity = lazy(() => import("./pages/GovernanceMaturity"));
const Compliance = lazy(() => import("./pages/Compliance"));
const AlertPlaybooks = lazy(() => import("./pages/AlertPlaybooks"));

// ── Organization & Admin ──
const Team = lazy(() => import("./pages/Team"));
const Clients = lazy(() => import("./pages/Clients"));
const Settings = lazy(() => import("./pages/Settings"));
const Billing = lazy(() => import("./pages/Billing"));
const SSOConfig = lazy(() => import("./pages/SSOConfig"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const PrivacyDashboard = lazy(() => import("./pages/PrivacyDashboard"));

// ── Public / Marketing ──
const Pricing = lazy(() => import("./pages/Pricing"));
const Demo = lazy(() => import("./pages/Demo"));
const Security = lazy(() => import("./pages/Security"));
const SecurityQuestionnaire = lazy(() => import("./pages/SecurityQuestionnaire"));
const Documentation = lazy(() => import("./pages/Documentation"));
const APIDocs = lazy(() => import("./pages/APIDocs"));
const BusinessModel = lazy(() => import("./pages/BusinessModel"));
const FounderHandbook = lazy(() => import("./pages/FounderHandbook"));
const WhyVsMicrosoft = lazy(() => import("./pages/WhyVsMicrosoft"));
const Pitch = lazy(() => import("./pages/Pitch"));
const Competitions = lazy(() => import("./pages/Competitions"));
const PitchDeck = lazy(() => import("./pages/PitchDeck"));
const Ebook = lazy(() => import("./pages/Ebook"));
const FreeAnalysis = lazy(() => import("./pages/FreeAnalysis"));
const EmbedDashboard = lazy(() => import("./pages/EmbedDashboard"));
const PilotAudit = lazy(() => import("./pages/PilotAudit"));
const SystemStatus = lazy(() => import("./pages/SystemStatus"));
const SLA = lazy(() => import("./pages/SLA"));
// ── Legal ──
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const DataProcessing = lazy(() => import("./pages/DataProcessing"));
const DataRetention = lazy(() => import("./pages/DataRetention"));
const Subprocessors = lazy(() => import("./pages/Subprocessors"));
const Impressum = lazy(() => import("./pages/Impressum"));

const NotFound = lazy(() => import("./pages/NotFound"));

// ═══════════════════════════════════════════════════════
// QUERY CLIENT — production-hardened defaults
// ═══════════════════════════════════════════════════════
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry 401/403 — those are auth/authz failures
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status === 401 || status === 403 || status === 404) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Route-level error boundary wrapper */
const SafeRoute = ({ children }: { children: ReactNode }) => (
  <RouteErrorBoundary fallback={(props) => <RouteErrorFallback {...props} />}>
    {children}
  </RouteErrorBoundary>
);

/** Providers stack for all protected routes */
const Providers = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <SidebarProvider>
      <WorkspaceProvider>
        <ProjectProvider>
          <DatasetProvider>
            {children}
          </DatasetProvider>
        </ProjectProvider>
      </WorkspaceProvider>
    </SidebarProvider>
  </ProtectedRoute>
);

/** Full shell: providers + sidebar + context bar + error boundary */
const P = ({ children }: { children: React.ReactNode }) => (
  <Providers>
    <ProtectedLayout>
      <SafeRoute>{children}</SafeRoute>
    </ProtectedLayout>
  </Providers>
);

/** Minimal: providers only (no sidebar/context bar) — for Onboarding, BoardReport */
const PMinimal = ({ children }: { children: React.ReactNode }) => (
  <Providers>
    <MinimalProtectedLayout>
      <SafeRoute>{children}</SafeRoute>
    </MinimalProtectedLayout>
  </Providers>
);

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <CookieConsent />
            <SessionTimeout />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ══════ Public ══════ */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<SafeRoute><Login /></SafeRoute>} />
              <Route path="/register" element={<SafeRoute><Register /></SafeRoute>} />
              <Route path="/forgot-password" element={<SafeRoute><ForgotPassword /></SafeRoute>} />
              <Route path="/reset-password" element={<SafeRoute><ResetPassword /></SafeRoute>} />
              <Route path="/accept-invite" element={<SafeRoute><AcceptInvite /></SafeRoute>} />
              <Route path="/demo" element={<SafeRoute><Demo /></SafeRoute>} />
              <Route path="/embed" element={<SafeRoute><EmbedDashboard /></SafeRoute>} />
              <Route path="/pricing" element={<SafeRoute><Pricing /></SafeRoute>} />
              <Route path="/calibration" element={<SafeRoute><CalibrationAssessment /></SafeRoute>} />
              <Route path="/free-analysis" element={<SafeRoute><FreeAnalysis /></SafeRoute>} />
              <Route path="/status" element={<SafeRoute><SystemStatus /></SafeRoute>} />
              <Route path="/sla" element={<SafeRoute><SLA /></SafeRoute>} />

              {/* ══════ Marketing / Trust ══════ */}
              <Route path="/business-model" element={<SafeRoute><BusinessModel /></SafeRoute>} />
              <Route path="/security" element={<SafeRoute><Security /></SafeRoute>} />
              <Route path="/security-questionnaire" element={<SafeRoute><SecurityQuestionnaire /></SafeRoute>} />
              <Route path="/handbook" element={<SafeRoute><FounderHandbook /></SafeRoute>} />
              <Route path="/vs/microsoft" element={<SafeRoute><WhyVsMicrosoft /></SafeRoute>} />
              <Route path="/pitch" element={<SafeRoute><Pitch /></SafeRoute>} />
              <Route path="/competitions" element={<SafeRoute><Competitions /></SafeRoute>} />
              <Route path="/pitch-deck" element={<SafeRoute><PitchDeck /></SafeRoute>} />
              <Route path="/ebook" element={<SafeRoute><Ebook /></SafeRoute>} />

              {/* ══════ Legal ══════ */}
              <Route path="/terms" element={<SafeRoute><Terms /></SafeRoute>} />
              <Route path="/privacy" element={<SafeRoute><Privacy /></SafeRoute>} />
              <Route path="/cookies" element={<SafeRoute><CookiePolicy /></SafeRoute>} />
              <Route path="/dpa" element={<SafeRoute><DataProcessing /></SafeRoute>} />
              <Route path="/data-retention" element={<SafeRoute><DataRetention /></SafeRoute>} />
              <Route path="/subprocessors" element={<SafeRoute><Subprocessors /></SafeRoute>} />

              {/* ══════ Standalone protected (no sidebar) ══════ */}
              <Route path="/onboarding" element={<PMinimal><Onboarding /></PMinimal>} />
              <Route path="/board-report" element={<PMinimal><BoardReport /></PMinimal>} />

              {/* ══════ Intelligence Core ══════ */}
              <Route path="/dashboard" element={<P><Dashboard /></P>} />
              <Route path="/kpis" element={<P><KPIs /></P>} />
              <Route path="/diagnostics" element={<P><Diagnostics /></P>} />
              <Route path="/advisory" element={<P><Advisory /></P>} />
              <Route path="/forecasting" element={<P><Forecasting /></P>} />
              <Route path="/ask" element={<P><NaturalLanguageQuery /></P>} />
              <Route path="/market-intelligence" element={<P><MarketIntelligence /></P>} />

              {/* ══════ Decision System ══════ */}
              <Route path="/decisions" element={<P><DecisionLedger /></P>} />
              <Route path="/decision-intelligence" element={<P><DecisionIntelligence /></P>} />
              <Route path="/decision-fitness" element={<P><DecisionFitness /></P>} />
              <Route path="/execution" element={<P><ExecutionDashboard /></P>} />
              <Route path="/cognitive-bias" element={<P><CognitiveBiasDetection /></P>} />
              <Route path="/counterfactual" element={<P><CounterfactualExplanation /></P>} />
              <Route path="/causal-inference" element={<P><CausalInference /></P>} />
              <Route path="/misses" element={<P><Misses /></P>} />
              <Route path="/decision-accuracy" element={<P><DecisionAccuracy /></P>} />

              {/* ══════ Scenarios & Simulations ══════ */}
              <Route path="/scenarios" element={<P><Scenarios /></P>} />
              <Route path="/simulations" element={<P><Simulations /></P>} />
              <Route path="/branching" element={<P><ScenarioBranching /></P>} />

              {/* ══════ Data Platform ══════ */}
              <Route path="/data-upload" element={<P><DataUpload /></P>} />
              <Route path="/data-sources" element={<P><DataSources /></P>} />
              <Route path="/data-connectors" element={<P><DataConnectors /></P>} />
              <Route path="/dataset-explorer" element={<P><DatasetExplorer /></P>} />
              <Route path="/data-catalog" element={<P><DataCatalog /></P>} />
              <Route path="/lineage" element={<P><DataLineage /></P>} />
              <Route path="/pipeline" element={<P><PipelineObservability /></P>} />

              {/* ══════ Reporting & Strategy ══════ */}
              <Route path="/reports" element={<P><Reports /></P>} />
              <Route path="/executive" element={<P><Executive /></P>} />
              <Route path="/strategy-pack" element={<P><StrategyPack /></P>} />
              <Route path="/benchmarking" element={<P><Benchmarking /></P>} />
              <Route path="/okrs" element={<P><OKRs /></P>} />
              <Route path="/portfolio" element={<P><Portfolio /></P>} />

              {/* ══════ Governance & Compliance ══════ */}
              <Route path="/governance" element={<P><GovernanceCommandView /></P>} />
              <Route path="/governance-maturity" element={<P><GovernanceMaturity /></P>} />
              <Route path="/compliance" element={<P><Compliance /></P>} />
              <Route path="/alert-playbooks" element={<P><AlertPlaybooks /></P>} />

              {/* ══════ Organization & Admin ══════ */}
              <Route path="/team" element={<P><Team /></P>} />
              <Route path="/clients" element={<P><Clients /></P>} />
              <Route path="/billing" element={<P><Billing /></P>} />
              <Route path="/settings" element={<P><Settings /></P>} />
              <Route path="/sso" element={<P><SSOConfig /></P>} />
              <Route path="/privacy-dashboard" element={<P><PrivacyDashboard /></P>} />
              <Route path="/docs" element={<P><Documentation /></P>} />
              <Route path="/api-docs" element={<P><APIDocs /></P>} />
              <Route path="/pilot-audit" element={<P><PilotAudit /></P>} />

              <Route path="*" element={<SafeRoute><NotFound /></SafeRoute>} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
