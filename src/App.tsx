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
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import DataUpload from "./pages/DataUpload";
import DataSources from "./pages/DataSources";
import KPIs from "./pages/KPIs";
import Scenarios from "./pages/Scenarios";
import Reports from "./pages/Reports";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import Executive from "./pages/Executive";
import BoardReport from "./pages/BoardReport";
import Team from "./pages/Team";
import Clients from "./pages/Clients";
import AcceptInvite from "./pages/AcceptInvite";
import Onboarding from "./pages/Onboarding";
import Billing from "./pages/Billing";
import Diagnostics from "./pages/Diagnostics";
import Advisory from "./pages/Advisory";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import CookiePolicy from "./pages/CookiePolicy";
import DataProcessing from "./pages/DataProcessing";
import DataRetention from "./pages/DataRetention";
import Subprocessors from "./pages/Subprocessors";

const queryClient = new QueryClient();

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
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/data-upload" element={<ProtectedRoute><DataUpload /></ProtectedRoute>} />
              <Route path="/data-sources" element={<ProtectedRoute><DataSources /></ProtectedRoute>} />
              <Route path="/kpis" element={<ProtectedRoute><KPIs /></ProtectedRoute>} />
              <Route path="/diagnostics" element={<ProtectedRoute><Diagnostics /></ProtectedRoute>} />
              <Route path="/advisory" element={<ProtectedRoute><Advisory /></ProtectedRoute>} />
              <Route path="/scenarios" element={<ProtectedRoute><Scenarios /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/executive" element={<ProtectedRoute><Executive /></ProtectedRoute>} />
              <Route path="/board-report" element={<ProtectedRoute><BoardReport /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SidebarProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
