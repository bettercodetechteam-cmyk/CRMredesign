import React, { useEffect, useState, Suspense, lazy, Component, ErrorInfo, ReactNode, memo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CentreDataProvider } from "@/contexts/CentreDataContext";
import { NavigationLoadingProvider } from "@/contexts/NavigationLoadingContext";
import { trackPageView } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/useAnalytics";
import Layout from "@/components/Layout";
import { PermissionRoute } from "@/components/ProtectedRoute";
import GlobalReminderNotification from "@/components/GlobalReminderNotification";
import Login from "@/pages/Login";
import TestCredentials from "@/pages/TestCredentials";
import Loading from "@/components/ui/loading";
import NetworkErrorBoundary from "@/components/NetworkErrorBoundary";
import FirebaseTest from "@/components/FirebaseTest";
import QuotaMonitor from "@/components/QuotaMonitor";
import OfflineIndicator from "@/components/OfflineIndicator";
import { quotaMonitor } from "@/lib/quotaMonitor";
import { fallbackService } from "@/lib/fallbackService";
import { ensureFirebaseReady } from "@/lib/firebase";

// Lazy imports for better performance
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Students = lazy(() => import("@/pages/Students"));
const Leads = lazy(() => import("@/pages/Leads"));
const Academics = lazy(() => import("@/pages/Academics"));
const Batches = lazy(() => import("@/pages/Batches"));
const Courses = lazy(() => import("@/pages/Courses"));
const FeeManagement = lazy(() => import("@/pages/FeeManagement"));
const Assignments = lazy(() => import("@/pages/Assignments"));
const Staff = lazy(() => import("@/pages/Staff"));
const UserApprovals = lazy(() => import("@/pages/UserApprovals"));
const Assets = lazy(() => import("@/pages/Assets"));
const Royalty = lazy(() => import("@/pages/Royalty"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Targets = lazy(() => import("@/pages/Targets"));
const Reports = lazy(() => import("@/pages/Reports"));
const Performance = lazy(() => import("@/pages/Performance"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const PromotionalOffers = lazy(() => import("@/pages/PromotionalOffers"));
const BlogManagement = lazy(() => import("@/pages/BlogManagement"));
const BlogEditor = lazy(() => import("@/pages/BlogEditor"));
const AccessManagement = lazy(() => import("@/pages/AccessManagement"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const TaskDetail = lazy(() => import("@/pages/TaskDetail"));
const Unauthorized = lazy(() => import("@/pages/Unauthorized"));
const PendingApproval = lazy(() => import("@/pages/PendingApproval"));


const FeeAlerts = lazy(() => import("@/pages/FeeAlerts"));


// Academic management pages
const FeesPage = lazy(() => import("@/pages/AcademicManagement/FeesPage"));
const ZimaFeesPage = lazy(() => import("@/pages/AcademicManagement/ZimaFeesPage"));
const ZicaManagement = lazy(() => import("@/pages/AcademicManagement/ZicaManagement"));
const ZimaManagement = lazy(() => import("@/pages/AcademicManagement/ZimaManagement"));
const OtherManagement = lazy(() => import("@/pages/AcademicManagement/OtherManagement"));
const CertificateManagement = lazy(() => import("@/pages/AcademicManagement/CertificateManagement"));
const EnhancedFeeManagement = lazy(() => import("@/pages/EnhancedFeeManagement"));
const ReceiptPage = lazy(() => import("@/pages/ReceiptPage"));
const BettercodeLogin = lazy(() => import("@/pages/bettercode/BettercodeLogin"));
const BettercodeDashboard = lazy(() => import("@/pages/bettercode/BettercodeDashboard"));
const BettercodeQuotation = lazy(() => import("@/pages/bettercode/BettercodeQuotation"));
const BettercodeInvoice = lazy(() => import("@/pages/bettercode/BettercodeInvoice"));

import type { ModulePermission } from "@shared/permissions";

function PermPage({
  permission,
  children,
}: {
  permission: ModulePermission;
  children: React.ReactNode;
}) {
  return (
    <PermissionRoute permission={permission}>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </PermissionRoute>
  );
}
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">Error: {this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const LoadingSpinner = memo(function LoadingSpinner() {
  return (
    <Loading 
      fullScreen={true}
      size="xl" 
      text="Loading ZICA CRM..." 
      color="primary"
    />
  );
});

function Router() {
  useAnalytics();
  const { userProfile, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingSpinner />;
  }

  // If authenticated but pending approval
  if (userProfile && userProfile.approved === false) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="*" element={<Navigate to="/pending-approval" replace />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  // If authenticated, render the full app (with router and all pages)
  if (userProfile && userProfile.approved !== false) {
    return (
      <ErrorBoundary>
        <NetworkErrorBoundary>
          <>
            <Routes>
            {/* Bettercode - separate sign-in and dashboard (no ZICA layout) */}
            <Route path="/bettercode/dashboard" element={
              <Suspense fallback={<LoadingSpinner />}>
                <BettercodeDashboard />
              </Suspense>
            } />
            <Route path="/bettercode/quotation" element={
              <Suspense fallback={<LoadingSpinner />}>
                <BettercodeQuotation />
              </Suspense>
            } />
            <Route path="/bettercode/invoice" element={
              <Suspense fallback={<LoadingSpinner />}>
                <BettercodeInvoice />
              </Suspense>
            } />
            <Route path="/bettercode" element={<Navigate to="/bettercode/dashboard" replace />} />
            {/* Receipt page - no layout/sidebar */}
            <Route path="/receipt" element={
              <PermPage permission="fees"><ReceiptPage /></PermPage>
            } />
            
            <Route element={<Layout />}>
              <Route path="/" element={<PermPage permission="dashboard"><Dashboard /></PermPage>} />
              <Route path="/dashboard" element={<PermPage permission="dashboard"><Dashboard /></PermPage>} />
              <Route path="/students" element={<PermPage permission="students"><Students /></PermPage>} />
              <Route path="/leads" element={<PermPage permission="leads"><Leads /></PermPage>} />
              <Route path="/academics" element={<PermPage permission="academics"><Academics /></PermPage>} />
              <Route path="/academics/fees" element={<PermPage permission="academics"><FeesPage /></PermPage>} />
              <Route path="/academics/zima-fees" element={<PermPage permission="academics"><ZimaFeesPage /></PermPage>} />
              <Route path="/academics/zica-management" element={<PermPage permission="academics"><ZicaManagement /></PermPage>} />
              <Route path="/academics/zima-management" element={<PermPage permission="academics"><ZimaManagement /></PermPage>} />
              <Route path="/academics/other" element={<PermPage permission="academics"><OtherManagement /></PermPage>} />
              <Route path="/academics/certificates" element={<PermPage permission="academics"><CertificateManagement /></PermPage>} />
              <Route path="/batches" element={<PermPage permission="batches"><Batches /></PermPage>} />
              <Route path="/courses" element={<PermPage permission="courses"><Courses /></PermPage>} />
              <Route path="/fee-management" element={<PermPage permission="fees"><FeeManagement /></PermPage>} />
              <Route path="/enhanced-fee-management" element={<PermPage permission="fees"><EnhancedFeeManagement /></PermPage>} />
              <Route path="/fee-alerts" element={<PermPage permission="fees"><FeeAlerts /></PermPage>} />
              <Route path="/assignments" element={<PermPage permission="assignments"><Assignments /></PermPage>} />
              <Route path="/assets" element={<PermPage permission="assets"><Assets /></PermPage>} />
              <Route path="/user-approvals" element={<PermPage permission="user_approvals"><UserApprovals /></PermPage>} />
              <Route path="/access-management" element={<PermPage permission="access_management"><AccessManagement /></PermPage>} />
              <Route path="/staff" element={<PermPage permission="staff"><Staff /></PermPage>} />
              <Route path="/tasks" element={<PermPage permission="tasks"><Tasks /></PermPage>} />
              <Route path="/tasks/:taskId" element={<PermPage permission="tasks"><TaskDetail /></PermPage>} />
              <Route path="/royalty" element={<PermPage permission="fees"><Royalty /></PermPage>} />
              <Route path="/expenses" element={<PermPage permission="expenses"><Expenses /></PermPage>} />
              <Route path="/targets" element={<PermPage permission="targets"><Targets /></PermPage>} />
              <Route path="/reports" element={<PermPage permission="reports"><Reports /></PermPage>} />
              <Route path="/performance" element={<PermPage permission="reports"><Performance /></PermPage>} />
              <Route path="/settings" element={<PermPage permission="settings"><Settings /></PermPage>} />
              <Route path="/profile" element={<PermPage permission="profile"><Profile /></PermPage>} />
              <Route path="/promotional-offers" element={<PermPage permission="promotional_offers"><PromotionalOffers /></PermPage>} />
              <Route path="/blogs" element={<PermPage permission="blogs"><BlogManagement /></PermPage>} />
              <Route path="/blogs/new" element={<PermPage permission="blogs"><BlogEditor /></PermPage>} />
              <Route path="/blogs/edit/:id" element={<PermPage permission="blogs"><BlogEditor /></PermPage>} />
              <Route path="/unauthorized" element={
                <Suspense fallback={<LoadingSpinner />}><Unauthorized /></Suspense>
              } />


              <Route path="*" element={
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
                    <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                  </div>
                </div>
              } />
            </Route>
          </Routes>
          <GlobalReminderNotification />
        </>
        </NetworkErrorBoundary>
      </ErrorBoundary>
    );
  }

  // Otherwise, show Login page or Bettercode login or Test Credentials
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/test-credentials" element={<TestCredentials />} />
        <Route path="/firebase-test" element={<FirebaseTest />} />
        <Route path="/bettercode" element={
          <Suspense fallback={<LoadingSpinner />}>
            <BettercodeLogin />
          </Suspense>
        } />
        <Route path="*" element={<Login />} />
      </Routes>
    </ErrorBoundary>
  );
}

function FirebaseConfigError() {
  const configUrl = typeof window !== 'undefined' ? `${window.location.origin}/config/firebase.json` : '/config/firebase.json';
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-lg text-center space-y-4">
        <h1 className="text-xl font-semibold text-red-600">Firebase not configured</h1>
        <p className="text-gray-600 text-sm">
          This build has no Firebase env. The app tried to load config from <strong>{configUrl}</strong> but the server returned the app (HTML) instead of JSON — usually because <code className="bg-gray-100 px-1">config/firebase.json</code> is not in the deployed folder.
        </p>
        <div className="text-left bg-white p-4 rounded border border-gray-200 space-y-2 text-sm">
          <p className="font-medium text-gray-800">Fix: build with Firebase env so the config file is included in the build:</p>
          <p>On the machine where you run the build, create <code className="bg-gray-100 px-1">client/.env</code> with <code className="bg-gray-100 px-1">VITE_FIREBASE_API_KEY</code>, <code className="bg-gray-100 px-1">VITE_FIREBASE_PROJECT_ID</code>, <code className="bg-gray-100 px-1">VITE_FIREBASE_AUTH_DOMAIN</code>, <code className="bg-gray-100 px-1">VITE_FIREBASE_STORAGE_BUCKET</code>, <code className="bg-gray-100 px-1">VITE_FIREBASE_MESSAGING_SENDER_ID</code>, <code className="bg-gray-100 px-1">VITE_FIREBASE_APP_ID</code>. Then run <code className="bg-gray-100 px-1">npm run build</code> and redeploy the whole <code className="bg-gray-100 px-1">dist/public</code> folder (so <code className="bg-gray-100 px-1">config/firebase.json</code> is created and deployed).</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function App() {
  const [firebaseReady, setFirebaseReady] = useState<boolean | null>(null);

  useEffect(() => {
    ensureFirebaseReady()
      .then(() => setFirebaseReady(true))
      .catch(() => setFirebaseReady(false));
  }, []);

  useEffect(() => {
    if (firebaseReady !== true) return;
    trackPageView('app_initialization');
    quotaMonitor.onAlert((alert) => {
      console.warn('Firebase Quota Alert:', alert);
    });
    fallbackService.onOfflineModeChange(() => {});
  }, [firebaseReady]);

  if (firebaseReady === null) {
    return (
      <Loading fullScreen size="xl" text="Loading ZICA CRM..." color="primary" />
    );
  }
  if (firebaseReady === false) {
    return <FirebaseConfigError />;
  }

  return (
    <BrowserRouter>
      <NavigationLoadingProvider>
        <AuthProvider>
          <CentreDataProvider>
            <div className="min-h-screen bg-gray-50">
              <OfflineIndicator className="fixed top-0 left-0 right-0 z-50" />
              <Router />
              <Toaster />
            </div>
          </CentreDataProvider>
        </AuthProvider>
      </NavigationLoadingProvider>
    </BrowserRouter>
  );
}

export default App;