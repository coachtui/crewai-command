// ============================================================================
// CrewAI Command: Main Application
// Multi-Tenant Construction Crew Management System
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { Login } from './pages/Login';
import { Workers } from './pages/admin/Workers';
import { Tasks } from './pages/admin/Tasks';
import { Calendar } from './pages/admin/Calendar';
import { Activities } from './pages/admin/Activities';
import { DailyHours } from './pages/admin/DailyHours';
import { Today } from './pages/foreman/Today';
import { Sidebar } from './components/layout/Sidebar';
import { VoiceFloatingButton } from './components/mobile/VoiceFloatingButton';
import { AuthProvider, JobSiteProvider, useAuth } from './contexts';
import { supabase } from './lib/supabase';

// ============================================================================
// Protected Route Wrapper
// ============================================================================

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading while checking auth
  if (isAuthenticated === null) {
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
// Dashboard Placeholder (Coming Soon)
// ============================================================================

function Dashboard() {
  const { user } = useAuth();
  
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-2">
          Welcome back, {user?.name || 'User'}!
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder cards */}
        <div className="bg-bg-secondary border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Active Tasks</h3>
          <p className="text-3xl font-bold text-primary">--</p>
          <p className="text-sm text-text-secondary mt-1">Coming soon</p>
        </div>
        
        <div className="bg-bg-secondary border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Workers on Site</h3>
          <p className="text-3xl font-bold text-success">--</p>
          <p className="text-sm text-text-secondary mt-1">Coming soon</p>
        </div>
        
        <div className="bg-bg-secondary border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Pending Requests</h3>
          <p className="text-3xl font-bold text-warning">--</p>
          <p className="text-sm text-text-secondary mt-1">Coming soon</p>
        </div>
      </div>
      
      <div className="mt-8 p-6 bg-bg-secondary border border-border rounded-lg">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Multi-Tenant Features (Coming Soon)</h3>
        <ul className="space-y-2 text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="text-primary">•</span>
            Job Site Overview - View all job sites at a glance
          </li>
          <li className="flex items-center gap-2">
            <span className="text-primary">•</span>
            Resource Distribution - Move workers between sites
          </li>
          <li className="flex items-center gap-2">
            <span className="text-primary">•</span>
            Company Analytics - Track performance across all sites
          </li>
          <li className="flex items-center gap-2">
            <span className="text-primary">•</span>
            Team Management - Invite and manage team members
          </li>
        </ul>
      </div>
    </div>
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
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/workers" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/job-sites"
            element={
              <ProtectedRoute>
                <JobSites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workers"
            element={
              <ProtectedRoute>
                <Workers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <ProtectedRoute>
                <Activities />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-hours"
            element={
              <ProtectedRoute>
                <DailyHours />
              </ProtectedRoute>
            }
          />
          <Route
            path="/today"
            element={
              <ProtectedRoute>
                <Today />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
