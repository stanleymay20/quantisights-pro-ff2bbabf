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

// Eager: landing page (critical path)
import Index from "./pages/Index";

// Lazy: everything else
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DataUpload = lazy(() => import("./pages/DataUpload"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min — avoid refetch storms
      gcTime: 15 * 60 * 1000,         // 15 min garbage collection
      retry: 1,                        // single retry, fail fast
      refetchOnWindowFocus: false,     // prevent tab-switch refetches
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
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
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes — no sidebar context needed */}
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
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/security" element={<Security />} />
              <Route path="/security-questionnaire" element={<SecurityQuestionnaire />} />
              <Route path="/calibration" element={<CalibrationAssessment />} />
              <Route path="*" element={<NotFound />} />

              {/* Protected routes — wrapped in SidebarProvider + WorkspaceProvider + ProjectProvider */}
              <Route path="/onboarding" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Onboarding /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Dashboard /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/data-upload" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><DataUpload /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/data-sources" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><DataSources /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/kpis" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><KPIs /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/diagnostics" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Diagnostics /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/advisory" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Advisory /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/decisions" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><DecisionLedger /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/decision-intelligence" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><DecisionIntelligence /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/benchmarking" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Benchmarking /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/scenarios" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Scenarios /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/simulations" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Simulations /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Reports /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/strategy-pack" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><StrategyPack /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/executive" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Executive /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/board-report" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><BoardReport /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Team /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Clients /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Billing /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Settings /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/docs" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Documentation /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/ask" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><NaturalLanguageQuery /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/branching" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><ScenarioBranching /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/market-intelligence" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><MarketIntelligence /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/forecasting" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Forecasting /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/lineage" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><DataLineage /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/okrs" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><OKRs /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/alert-playbooks" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><AlertPlaybooks /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/causal-inference" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><CausalInference /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/cognitive-bias" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><CognitiveBiasDetection /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/counterfactual" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><CounterfactualExplanation /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/misses" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Misses /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
              <Route path="/portfolio" element={<ProtectedRoute><SidebarProvider><WorkspaceProvider><ProjectProvider><DatasetProvider><Portfolio /></DatasetProvider></ProjectProvider></WorkspaceProvider></SidebarProvider></ProtectedRoute>} />
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
