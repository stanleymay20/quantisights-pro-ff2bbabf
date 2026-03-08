import { lazy, Suspense } from "react";
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
import { ThemeProvider } from "@/components/ThemeProvider";
import ProtectedLayout, { MinimalProtectedLayout } from "@/components/layout/ProtectedLayout";
import CookieConsent from "@/components/CookieConsent";
import SessionTimeout from "@/components/auth/SessionTimeout";

// Eager: landing page (critical path)
import Index from "./pages/Index";

// Lazy: everything else
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DataUpload = lazy(() => import("./pages/DataUpload"));
const DataConnectors = lazy(() => import("./pages/DataConnectors"));
const DataSources = lazy(() => import("./pages/DataSources"));
const KPIs = lazy(() => import("./pages/KPIs"));
const Scenarios = lazy(() => import("./pages/Scenarios"));
const Reports = lazy(() => import("./pages/Reports"));
const Pricing = lazy(() => import("./pages/Pricing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Executive = lazy(() => import("./pages/Executive"));
const BoardReport = lazy(() => import("./pages/BoardReport"));
const Team = lazy(() => import("./pages/Team"));
const Clients = lazy(() => import("./pages/Clients"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Billing = lazy(() => import("./pages/Billing"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Advisory = lazy(() => import("./pages/Advisory"));
const DecisionLedger = lazy(() => import("./pages/DecisionLedger"));
const Benchmarking = lazy(() => import("./pages/Benchmarking"));
const Settings = lazy(() => import("./pages/Settings"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const DataProcessing = lazy(() => import("./pages/DataProcessing"));
const DataRetention = lazy(() => import("./pages/DataRetention"));
const Subprocessors = lazy(() => import("./pages/Subprocessors"));
const Simulations = lazy(() => import("./pages/Simulations"));
const StrategyPack = lazy(() => import("./pages/StrategyPack"));
const DecisionIntelligence = lazy(() => import("./pages/DecisionIntelligence"));
const Documentation = lazy(() => import("./pages/Documentation"));
const NaturalLanguageQuery = lazy(() => import("./pages/NaturalLanguageQuery"));
const ScenarioBranching = lazy(() => import("./pages/ScenarioBranching"));
const MarketIntelligence = lazy(() => import("./pages/MarketIntelligence"));
const Forecasting = lazy(() => import("./pages/Forecasting"));
const DataLineage = lazy(() => import("./pages/DataLineage"));
const OKRs = lazy(() => import("./pages/OKRs"));
const AlertPlaybooks = lazy(() => import("./pages/AlertPlaybooks"));
const CausalInference = lazy(() => import("./pages/CausalInference"));
const CognitiveBiasDetection = lazy(() => import("./pages/CognitiveBiasDetection"));
const CounterfactualExplanation = lazy(() => import("./pages/CounterfactualExplanation"));
const Demo = lazy(() => import("./pages/Demo"));
const CalibrationAssessment = lazy(() => import("./pages/CalibrationAssessment"));
const Misses = lazy(() => import("./pages/Misses"));
const Security = lazy(() => import("./pages/Security"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const SecurityQuestionnaire = lazy(() => import("./pages/SecurityQuestionnaire"));
const PilotAudit = lazy(() => import("./pages/PilotAudit"));
const BusinessModel = lazy(() => import("./pages/BusinessModel"));
const DatasetExplorer = lazy(() => import("./pages/DatasetExplorer"));
const Compliance = lazy(() => import("./pages/Compliance"));
const SSOConfig = lazy(() => import("./pages/SSOConfig"));
const APIDocs = lazy(() => import("./pages/APIDocs"));
const PipelineObservability = lazy(() => import("./pages/PipelineObservability"));
const DataCatalog = lazy(() => import("./pages/DataCatalog"));
const EmbedDashboard = lazy(() => import("./pages/EmbedDashboard"));
const FounderHandbook = lazy(() => import("./pages/FounderHandbook"));
const PrivacyDashboard = lazy(() => import("./pages/PrivacyDashboard"));
const WhyVsMicrosoft = lazy(() => import("./pages/WhyVsMicrosoft"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
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

/** Full shell: providers + sidebar + context bar */
const P = ({ children }: { children: React.ReactNode }) => (
  <Providers>
    <ProtectedLayout>{children}</ProtectedLayout>
  </Providers>
);

/** Minimal: providers only (no sidebar/context bar) — for Onboarding, BoardReport */
const PMinimal = ({ children }: { children: React.ReactNode }) => (
  <Providers>
    <MinimalProtectedLayout>{children}</MinimalProtectedLayout>
  </Providers>
);

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CookieConsent />
            <SessionTimeout />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/dpa" element={<DataProcessing />} />
              <Route path="/data-retention" element={<DataRetention />} />
              <Route path="/subprocessors" element={<Subprocessors />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/embed" element={<EmbedDashboard />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/business-model" element={<BusinessModel />} />
              <Route path="/security" element={<Security />} />
              <Route path="/security-questionnaire" element={<SecurityQuestionnaire />} />
              <Route path="/calibration" element={<CalibrationAssessment />} />
              <Route path="/handbook" element={<FounderHandbook />} />
              <Route path="*" element={<NotFound />} />

              {/* Standalone protected routes (no sidebar shell) */}
              <Route path="/onboarding" element={<PMinimal><Onboarding /></PMinimal>} />
              <Route path="/board-report" element={<PMinimal><BoardReport /></PMinimal>} />

              {/* Protected routes — unified shell with sidebar + context bar */}
              <Route path="/dashboard" element={<P><Dashboard /></P>} />
              <Route path="/data-upload" element={<P><DataUpload /></P>} />
              <Route path="/data-sources" element={<P><DataSources /></P>} />
              <Route path="/data-connectors" element={<P><DataConnectors /></P>} />
              <Route path="/kpis" element={<P><KPIs /></P>} />
              <Route path="/diagnostics" element={<P><Diagnostics /></P>} />
              <Route path="/advisory" element={<P><Advisory /></P>} />
              <Route path="/decisions" element={<P><DecisionLedger /></P>} />
              <Route path="/decision-intelligence" element={<P><DecisionIntelligence /></P>} />
              <Route path="/benchmarking" element={<P><Benchmarking /></P>} />
              <Route path="/scenarios" element={<P><Scenarios /></P>} />
              <Route path="/simulations" element={<P><Simulations /></P>} />
              <Route path="/reports" element={<P><Reports /></P>} />
              <Route path="/strategy-pack" element={<P><StrategyPack /></P>} />
              <Route path="/executive" element={<P><Executive /></P>} />
              <Route path="/team" element={<P><Team /></P>} />
              <Route path="/clients" element={<P><Clients /></P>} />
              <Route path="/billing" element={<P><Billing /></P>} />
              <Route path="/settings" element={<P><Settings /></P>} />
              <Route path="/docs" element={<P><Documentation /></P>} />
              <Route path="/ask" element={<P><NaturalLanguageQuery /></P>} />
              <Route path="/branching" element={<P><ScenarioBranching /></P>} />
              <Route path="/market-intelligence" element={<P><MarketIntelligence /></P>} />
              <Route path="/forecasting" element={<P><Forecasting /></P>} />
              <Route path="/lineage" element={<P><DataLineage /></P>} />
              <Route path="/okrs" element={<P><OKRs /></P>} />
              <Route path="/alert-playbooks" element={<P><AlertPlaybooks /></P>} />
              <Route path="/causal-inference" element={<P><CausalInference /></P>} />
              <Route path="/cognitive-bias" element={<P><CognitiveBiasDetection /></P>} />
              <Route path="/counterfactual" element={<P><CounterfactualExplanation /></P>} />
              <Route path="/misses" element={<P><Misses /></P>} />
              <Route path="/portfolio" element={<P><Portfolio /></P>} />
              <Route path="/pilot-audit" element={<P><PilotAudit /></P>} />
              <Route path="/dataset-explorer" element={<P><DatasetExplorer /></P>} />
              <Route path="/compliance" element={<P><Compliance /></P>} />
              <Route path="/sso" element={<P><SSOConfig /></P>} />
              <Route path="/api-docs" element={<P><APIDocs /></P>} />
              <Route path="/pipeline" element={<P><PipelineObservability /></P>} />
              <Route path="/data-catalog" element={<P><DataCatalog /></P>} />
              <Route path="/privacy-dashboard" element={<P><PrivacyDashboard /></P>} />
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
