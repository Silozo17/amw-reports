import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import BrandingProvider from "@/components/BrandingProvider";
import { OrgProvider } from "@/contexts/OrgContext";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import FeaturesPage from "./pages/FeaturesPage";
import PricingPage from "./pages/PricingPage";
import PublicLayout from "./components/landing/PublicLayout";
import Index from "./pages/Index";
import ClientList from "./pages/clients/ClientList";
import ClientForm from "./pages/clients/ClientForm";
import ClientDetail from "./pages/clients/ClientDetail";
import Reports from "./pages/Reports";
import Connections from "./pages/Connections";
import Logs from "./pages/Logs";
import DebugConsole from "./pages/DebugConsole";
import SettingsPage from "./pages/SettingsPage";
import ClientPortal from "./pages/ClientPortal";
import ClientPortalAuth from "./pages/ClientPortalAuth";
import OnboardingPage from "./pages/OnboardingPage";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrgList from "./pages/admin/AdminOrgList";
import AdminOrgDetail from "./pages/admin/AdminOrgDetail";
import AdminActivityLog from "./pages/admin/AdminActivityLog";
import AdminUserList from "./pages/admin/AdminUserList";
import { usePlatformAdmin } from "./hooks/usePlatformAdmin";
import ScrollToTop from "./components/ScrollToTop";
import LoadingScreen from "./components/LoadingScreen";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isClientUser } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Client users should be redirected to their portal
  if (isClientUser) {
    return <Navigate to="/client-portal" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();

  if (authLoading || adminLoading) {
    return <LoadingScreen />;
  }

  if (!user || !isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isClientUser } = useAuth();

  if (isLoading) return null;
  if (user && isClientUser) return <Navigate to="/client-portal" replace />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function PublicPageRoute({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<PublicPageRoute><HomePage /></PublicPageRoute>} />
    <Route path="/features" element={<PublicPageRoute><FeaturesPage /></PublicPageRoute>} />
    <Route path="/pricing" element={<PublicPageRoute><PricingPage /></PublicPageRoute>} />
    <Route path="/login" element={<PublicRoute><LandingPage /></PublicRoute>} />
    <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/clients" element={<ProtectedRoute><ClientList /></ProtectedRoute>} />
    <Route path="/clients/new" element={<ProtectedRoute><ClientForm /></ProtectedRoute>} />
    <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
    <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="/debug" element={<AdminRoute><DebugConsole /></AdminRoute>} />
    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    <Route path="/admin/organisations" element={<AdminRoute><AdminOrgList /></AdminRoute>} />
    <Route path="/admin/organisations/:id" element={<AdminRoute><AdminOrgDetail /></AdminRoute>} />
    <Route path="/admin/users" element={<AdminRoute><AdminUserList /></AdminRoute>} />
    <Route path="/admin/activity" element={<AdminRoute><AdminActivityLog /></AdminRoute>} />
    <Route path="/portal/:token" element={<ClientPortal />} />
    <Route path="/client-portal" element={<ClientPortalAuth />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <OrgProvider>
            <BrandingProvider>
              <AppRoutes />
            </BrandingProvider>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
