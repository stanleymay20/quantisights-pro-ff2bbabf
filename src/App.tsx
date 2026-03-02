import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
              <Route path="*" element={<NotFound />} />

              {/* Protected routes — wrapped in SidebarProvider */}
              <Route path="/onboarding" element={<ProtectedRoute><SidebarProvider><Onboarding /></SidebarProvider></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><SidebarProvider><Dashboard /></SidebarProvider></ProtectedRoute>} />
              <Route path="/data-upload" element={<ProtectedRoute><SidebarProvider><DataUpload /></SidebarProvider></ProtectedRoute>} />
              <Route path="/data-sources" element={<ProtectedRoute><SidebarProvider><DataSources /></SidebarProvider></ProtectedRoute>} />
              <Route path="/kpis" element={<ProtectedRoute><SidebarProvider><KPIs /></SidebarProvider></ProtectedRoute>} />
              <Route path="/diagnostics" element={<ProtectedRoute><SidebarProvider><Diagnostics /></SidebarProvider></ProtectedRoute>} />
              <Route path="/advisory" element={<ProtectedRoute><SidebarProvider><Advisory /></SidebarProvider></ProtectedRoute>} />
              <Route path="/decisions" element={<ProtectedRoute><SidebarProvider><DecisionLedger /></SidebarProvider></ProtectedRoute>} />
              <Route path="/decision-intelligence" element={<ProtectedRoute><SidebarProvider><DecisionIntelligence /></SidebarProvider></ProtectedRoute>} />
              <Route path="/benchmarking" element={<ProtectedRoute><SidebarProvider><Benchmarking /></SidebarProvider></ProtectedRoute>} />
              <Route path="/scenarios" element={<ProtectedRoute><SidebarProvider><Scenarios /></SidebarProvider></ProtectedRoute>} />
              <Route path="/simulations" element={<ProtectedRoute><SidebarProvider><Simulations /></SidebarProvider></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><SidebarProvider><Reports /></SidebarProvider></ProtectedRoute>} />
              <Route path="/strategy-pack" element={<ProtectedRoute><SidebarProvider><StrategyPack /></SidebarProvider></ProtectedRoute>} />
              <Route path="/executive" element={<ProtectedRoute><SidebarProvider><Executive /></SidebarProvider></ProtectedRoute>} />
              <Route path="/board-report" element={<ProtectedRoute><SidebarProvider><BoardReport /></SidebarProvider></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><SidebarProvider><Team /></SidebarProvider></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><SidebarProvider><Clients /></SidebarProvider></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute><SidebarProvider><Billing /></SidebarProvider></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SidebarProvider><Settings /></SidebarProvider></ProtectedRoute>} />
              <Route path="/docs" element={<ProtectedRoute><SidebarProvider><Documentation /></SidebarProvider></ProtectedRoute>} />
              <Route path="/ask" element={<ProtectedRoute><SidebarProvider><NaturalLanguageQuery /></SidebarProvider></ProtectedRoute>} />
              <Route path="/branching" element={<ProtectedRoute><SidebarProvider><ScenarioBranching /></SidebarProvider></ProtectedRoute>} />
              <Route path="/market-intelligence" element={<ProtectedRoute><SidebarProvider><MarketIntelligence /></SidebarProvider></ProtectedRoute>} />
              <Route path="/forecasting" element={<ProtectedRoute><SidebarProvider><Forecasting /></SidebarProvider></ProtectedRoute>} />
              <Route path="/lineage" element={<ProtectedRoute><SidebarProvider><DataLineage /></SidebarProvider></ProtectedRoute>} />
              <Route path="/okrs" element={<ProtectedRoute><SidebarProvider><OKRs /></SidebarProvider></ProtectedRoute>} />
              <Route path="/alert-playbooks" element={<ProtectedRoute><SidebarProvider><AlertPlaybooks /></SidebarProvider></ProtectedRoute>} />
              <Route path="/causal-inference" element={<ProtectedRoute><SidebarProvider><CausalInference /></SidebarProvider></ProtectedRoute>} />
              <Route path="/cognitive-bias" element={<ProtectedRoute><SidebarProvider><CognitiveBiasDetection /></SidebarProvider></ProtectedRoute>} />
              <Route path="/counterfactual" element={<ProtectedRoute><SidebarProvider><CounterfactualExplanation /></SidebarProvider></ProtectedRoute>} />
              <Route path="/calibration" element={<ProtectedRoute><SidebarProvider><CalibrationAssessment /></SidebarProvider></ProtectedRoute>} />
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
