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
            <SidebarProvider>
            <Suspense fallback={<PageLoader />}>
            <Routes>
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
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/data-upload" element={<ProtectedRoute><DataUpload /></ProtectedRoute>} />
              <Route path="/data-sources" element={<ProtectedRoute><DataSources /></ProtectedRoute>} />
              <Route path="/kpis" element={<ProtectedRoute><KPIs /></ProtectedRoute>} />
              <Route path="/diagnostics" element={<ProtectedRoute><Diagnostics /></ProtectedRoute>} />
              <Route path="/advisory" element={<ProtectedRoute><Advisory /></ProtectedRoute>} />
              <Route path="/decisions" element={<ProtectedRoute><DecisionLedger /></ProtectedRoute>} />
              <Route path="/decision-intelligence" element={<ProtectedRoute><DecisionIntelligence /></ProtectedRoute>} />
              <Route path="/benchmarking" element={<ProtectedRoute><Benchmarking /></ProtectedRoute>} />
              <Route path="/scenarios" element={<ProtectedRoute><Scenarios /></ProtectedRoute>} />
              <Route path="/simulations" element={<ProtectedRoute><Simulations /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/strategy-pack" element={<ProtectedRoute><StrategyPack /></ProtectedRoute>} />
              <Route path="/executive" element={<ProtectedRoute><Executive /></ProtectedRoute>} />
              <Route path="/board-report" element={<ProtectedRoute><BoardReport /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/docs" element={<ProtectedRoute><Documentation /></ProtectedRoute>} />
              <Route path="/ask" element={<ProtectedRoute><NaturalLanguageQuery /></ProtectedRoute>} />
              <Route path="/branching" element={<ProtectedRoute><ScenarioBranching /></ProtectedRoute>} />
              <Route path="/market-intelligence" element={<ProtectedRoute><MarketIntelligence /></ProtectedRoute>} />
              <Route path="/forecasting" element={<ProtectedRoute><Forecasting /></ProtectedRoute>} />
              <Route path="/lineage" element={<ProtectedRoute><DataLineage /></ProtectedRoute>} />
              <Route path="/okrs" element={<ProtectedRoute><OKRs /></ProtectedRoute>} />
              <Route path="/alert-playbooks" element={<ProtectedRoute><AlertPlaybooks /></ProtectedRoute>} />
              <Route path="/causal-inference" element={<ProtectedRoute><CausalInference /></ProtectedRoute>} />
              <Route path="/cognitive-bias" element={<ProtectedRoute><CognitiveBiasDetection /></ProtectedRoute>} />
              <Route path="/counterfactual" element={<ProtectedRoute><CounterfactualExplanation /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </SidebarProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
