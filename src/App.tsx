import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import BrandingProvider from "@/components/BrandingProvider";
import { OrgProvider } from "@/contexts/OrgContext";
import ScrollToTop from "./components/ScrollToTop";
import LoadingScreen from "./components/LoadingScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import PublicLayout from "./components/landing/PublicLayout";
import { usePlatformAdmin } from "./hooks/usePlatformAdmin";

// Eagerly loaded: landing / public pages (critical for FCP/LCP)
import HomePage from "./pages/HomePage";

// Lazy-loaded: all other pages
const LandingPage = lazy(() => import("./pages/LandingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SocialMediaReportingPage = lazy(() => import("./pages/SocialMediaReportingPage"));
const SeoReportingPage = lazy(() => import("./pages/SeoReportingPage"));
const PpcReportingPage = lazy(() => import("./pages/PpcReportingPage"));
const WhiteLabelReportsPage = lazy(() => import("./pages/WhiteLabelReportsPage"));
const ForAgenciesPage = lazy(() => import("./pages/ForAgenciesPage"));
const ForFreelancersPage = lazy(() => import("./pages/ForFreelancersPage"));
const ForSmbsPage = lazy(() => import("./pages/ForSmbsPage"));
const ForCreatorsPage = lazy(() => import("./pages/ForCreatorsPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const Index = lazy(() => import("./pages/Index"));
const ClientList = lazy(() => import("./pages/clients/ClientList"));
const ClientForm = lazy(() => import("./pages/clients/ClientForm"));
const ClientDetail = lazy(() => import("./pages/clients/ClientDetail"));
const Reports = lazy(() => import("./pages/Reports"));
const Connections = lazy(() => import("./pages/Connections"));
const Logs = lazy(() => import("./pages/Logs"));
const DebugConsole = lazy(() => import("./pages/DebugConsole"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const ClientPortalAuth = lazy(() => import("./pages/ClientPortalAuth"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ThreadsCallback = lazy(() => import("./pages/ThreadsCallback"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrgList = lazy(() => import("./pages/admin/AdminOrgList"));
const AdminOrgDetail = lazy(() => import("./pages/admin/AdminOrgDetail"));
const AdminActivityLog = lazy(() => import("./pages/admin/AdminActivityLog"));
const AdminUserList = lazy(() => import("./pages/admin/AdminUserList"));
const AdminContentLab = lazy(() => import("./pages/admin/AdminContentLab"));
const ContentLabPage = lazy(() => import("./pages/content-lab/ContentLabPage"));
const NicheFormPage = lazy(() => import("./pages/content-lab/NicheFormPage"));
const RunDetailPage = lazy(() => import("./pages/content-lab/RunDetailPage"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isClientUser } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

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
  <Suspense fallback={<LoadingScreen />}>
    <Routes>
      <Route path="/" element={<PublicPageRoute><HomePage /></PublicPageRoute>} />
      <Route path="/features" element={<PublicPageRoute><FeaturesPage /></PublicPageRoute>} />
      <Route path="/pricing" element={<PublicPageRoute><PricingPage /></PublicPageRoute>} />
      <Route path="/social-media-reporting" element={<PublicPageRoute><SocialMediaReportingPage /></PublicPageRoute>} />
      <Route path="/seo-reporting" element={<PublicPageRoute><SeoReportingPage /></PublicPageRoute>} />
      <Route path="/ppc-reporting" element={<PublicPageRoute><PpcReportingPage /></PublicPageRoute>} />
      <Route path="/white-label-reports" element={<PublicPageRoute><WhiteLabelReportsPage /></PublicPageRoute>} />
      <Route path="/for-agencies" element={<PublicPageRoute><ForAgenciesPage /></PublicPageRoute>} />
      <Route path="/for-freelancers" element={<PublicPageRoute><ForFreelancersPage /></PublicPageRoute>} />
      <Route path="/for-smbs" element={<PublicPageRoute><ForSmbsPage /></PublicPageRoute>} />
      <Route path="/for-creators" element={<PublicPageRoute><ForCreatorsPage /></PublicPageRoute>} />
      <Route path="/integrations" element={<PublicPageRoute><IntegrationsPage /></PublicPageRoute>} />
      <Route path="/how-it-works" element={<PublicPageRoute><HowItWorksPage /></PublicPageRoute>} />
      <Route path="/about" element={<PublicPageRoute><AboutPage /></PublicPageRoute>} />
      <Route path="/login" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/auth/threads/callback" element={<ThreadsCallback />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientList /></ProtectedRoute>} />
      <Route path="/clients/new" element={<ProtectedRoute><ClientForm /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/content-lab" element={<ProtectedRoute><ContentLabPage /></ProtectedRoute>} />
      <Route path="/content-lab/niche/new" element={<ProtectedRoute><NicheFormPage /></ProtectedRoute>} />
      <Route path="/content-lab/niche/:id" element={<ProtectedRoute><NicheFormPage /></ProtectedRoute>} />
      <Route path="/content-lab/run/:id" element={<ProtectedRoute><RunDetailPage /></ProtectedRoute>} />
      <Route path="/debug" element={<AdminRoute><DebugConsole /></AdminRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/organisations" element={<AdminRoute><AdminOrgList /></AdminRoute>} />
      <Route path="/admin/organisations/:id" element={<AdminRoute><AdminOrgDetail /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUserList /></AdminRoute>} />
      <Route path="/admin/activity" element={<AdminRoute><AdminActivityLog /></AdminRoute>} />
      <Route path="/admin/content-lab" element={<AdminRoute><AdminContentLab /></AdminRoute>} />
      <Route path="/portal/:token" element={<ClientPortal />} />
      <Route path="/client-portal" element={<ClientPortalAuth />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
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
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </BrandingProvider>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
