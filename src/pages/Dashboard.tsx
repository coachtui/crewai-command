import { useState } from 'react';
import { useAuth } from '../contexts';
import { JobSiteManagement } from '../components/admin/JobSiteManagement';
import { WorkerManagement } from '../components/admin/WorkerManagement';
import { UserManagement } from '../components/admin/UserManagement';

type DashboardTab = 'job-sites' | 'workers' | 'users' | 'billing';

export function Dashboard() {
  const { user } = useAuth();
  const isManager = user?.base_role === 'manager';
  const isAdmin = user?.base_role === 'admin';
  const hasManagementAccess = isManager || isAdmin;
  const [activeTab, setActiveTab] = useState<DashboardTab>('job-sites');

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-text-primary mb-2 tracking-tight">Dashboard</h1>
        <p className="text-[14px] text-text-secondary">Welcome back, {user?.name}!</p>
      </div>

      {/* Management Section */}
      {hasManagementAccess ? (
        <div>
          <div className="mb-6">
            <h2 className="text-[20px] font-semibold text-text-primary mb-2">Organization Management</h2>
            <p className="text-[14px] text-text-secondary">
              {isManager
                ? 'Manage job sites, workers, users, and billing across your organization'
                : 'Manage workers and users on your assigned job sites'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
            <button
              onClick={() => setActiveTab('job-sites')}
              className={`px-4 py-2.5 text-[14px] font-medium transition-all duration-150 ease-smooth whitespace-nowrap rounded-t-md ${
                activeTab === 'job-sites'
                  ? 'text-primary bg-primary-subtle border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              Job Sites
            </button>
            <button
              onClick={() => setActiveTab('workers')}
              className={`px-4 py-2.5 text-[14px] font-medium transition-all duration-150 ease-smooth whitespace-nowrap rounded-t-md ${
                activeTab === 'workers'
                  ? 'text-primary bg-primary-subtle border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              Workers
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 text-[14px] font-medium transition-all duration-150 ease-smooth whitespace-nowrap rounded-t-md ${
                activeTab === 'users'
                  ? 'text-primary bg-primary-subtle border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              Users
            </button>
            {isManager && (
              <button
                onClick={() => setActiveTab('billing')}
                className={`px-4 py-2.5 text-[14px] font-medium transition-all duration-150 ease-smooth whitespace-nowrap rounded-t-md ${
                  activeTab === 'billing'
                    ? 'text-primary bg-primary-subtle border-b-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                Billing
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'job-sites' && <JobSiteManagement />}
            {activeTab === 'workers' && <WorkerManagement />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'billing' && isManager && (
              <div className="text-center py-16 bg-bg-secondary rounded-lg border border-border">
                <p className="text-[15px] text-text-primary font-medium mb-2">Billing management coming soon</p>
                <p className="text-[14px] text-text-secondary">
                  Subscription and payment management will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Non-management view */
        <div className="text-center py-16 bg-bg-secondary rounded-lg border border-border shadow-subtle">
          <p className="text-[15px] text-text-primary font-medium mb-2">More features coming soon!</p>
          <p className="text-[14px] text-text-secondary">
            The dashboard will display personalized insights and quick actions based on your role.
          </p>
        </div>
      )}
    </div>
  );
}
