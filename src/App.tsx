// ============================================================================
// CrewAI Command: Main Application
// Multi-Tenant Construction Crew Management System
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Login } from './pages/Login';
import { SetPassword } from './pages/SetPassword';
import { Dashboard } from './pages/Dashboard';
import { Workers } from './pages/admin/Workers';
import { Tasks } from './pages/admin/Tasks';
import { Calendar } from './pages/admin/Calendar';
import { Activities } from './pages/admin/Activities';
import { DailyHours } from './pages/admin/DailyHours';
import { Today } from './pages/foreman/Today';
import { Sidebar } from './components/layout/Sidebar';
import { VoiceFloatingButton } from './components/mobile/VoiceFloatingButton';
import { AuthProvider, JobSiteProvider, useAuth } from './contexts';

// ============================================================================
// React Query Configuration
// ============================================================================

// Create a client with optimized settings for better UX
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh but cached for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      // Retry failed requests
      retry: 1,
      // Refetch on window focus but with a cooldown
      refetchOnWindowFocus: 'always',
      refetchOnMount: true,
      // Don't refetch on reconnect immediately (real-time handles this)
      refetchOnReconnect: false,
    },
  },
});

// Diagnostic helper
function logCheckpoint(name: string) {
  if (window.__APP_DIAGNOSTICS__) {
    const elapsed = Date.now() - window.__APP_DIAGNOSTICS__.startTime;
    window.__APP_DIAGNOSTICS__.checkpoints.push({ name, elapsed });
    console.log(`[DIAGNOSTIC] ${name} (${elapsed}ms)`);
  }
}

logCheckpoint('App.tsx loaded');

// ============================================================================
// Protected Route Wrapper
// ============================================================================

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content (JobSiteProvider moved to App level)
  return <>{children}</>;
}

// ============================================================================
// Protected Layout - Wraps all authenticated routes with shared layout
// ============================================================================

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <JobSiteProvider>
      <div className="flex h-screen bg-bg-primary">
        <Sidebar />
        <main className="flex-1 overflow-auto w-full md:w-auto">
          {children}
        </main>
        <VoiceFloatingButton />
      </div>
    </JobSiteProvider>
  );
}

// ============================================================================
// Job Sites Page Placeholder
// ============================================================================

function JobSites() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Job Sites</h1>
        <p className="text-text-secondary mt-2">
          Manage your construction job sites
        </p>
      </div>
      
      <div className="bg-bg-secondary border border-border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🏗️</span>
        </div>
        <h3 className="text-xl font-semibold text-text-primary mb-2">Job Site Management</h3>
        <p className="text-text-secondary mb-4">
          Create and manage job sites, assign personnel, and track progress.
        </p>
        <p className="text-sm text-text-secondary">
          This feature is part of the multi-tenant architecture upgrade.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

function App() {
  logCheckpoint('App component rendering');

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/" element={<Navigate to="/workers" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Dashboard />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/job-sites"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <JobSites />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/workers"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Workers />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Tasks />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Calendar />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activities"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Activities />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/daily-hours"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <DailyHours />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/today"
              element={
                <ProtectedRoute>
                  <ProtectedLayout>
                    <Today />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
