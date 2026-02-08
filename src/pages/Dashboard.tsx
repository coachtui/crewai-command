import { useState } from 'react';
import { useAuth } from '../contexts';
import { Card } from '../components/ui/Card';
import { JobSiteManagement } from '../components/admin/JobSiteManagement';
import { WorkerManagement } from '../components/admin/WorkerManagement';
import { UserManagement } from '../components/admin/UserManagement';
import { CheckSquare, Users, AlertCircle } from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.base_role === 'admin';
  const [activeTab, setActiveTab] = useState<'job-sites' | 'workers' | 'users'>('job-sites');

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-text-primary mb-2 tracking-tight">Dashboard</h1>
        <p className="text-[14px] text-text-secondary">Welcome back, {user?.name}!</p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        <Card className="!p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-primary-subtle flex items-center justify-center">
              <CheckSquare className="text-primary" size={22} />
            </div>
            <div>
              <p className="text-text-secondary text-[13px] mb-1">Active Tasks</p>
              <p className="text-[24px] font-semibold text-text-primary">--</p>
            </div>
          </div>
        </Card>

        <Card className="!p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-success/10 flex items-center justify-center">
              <Users className="text-success" size={22} />
            </div>
            <div>
              <p className="text-text-secondary text-[13px] mb-1">Workers on Site</p>
              <p className="text-[24px] font-semibold text-text-primary">--</p>
            </div>
          </div>
        </Card>

        <Card className="!p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-warning/10 flex items-center justify-center">
              <AlertCircle className="text-warning" size={22} />
            </div>
            <div>
              <p className="text-text-secondary text-[13px] mb-1">Pending Requests</p>
              <p className="text-[24px] font-semibold text-text-primary">--</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Admin Management Section */}
      {isAdmin ? (
        <div>
          <div className="mb-6">
            <h2 className="text-[20px] font-semibold text-text-primary mb-2">Organization Management</h2>
            <p className="text-[14px] text-text-secondary">Manage job sites, workers, and user access across your organization</p>
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
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'job-sites' && <JobSiteManagement />}
            {activeTab === 'workers' && <WorkerManagement />}
            {activeTab === 'users' && <UserManagement />}
          </div>
        </div>
      ) : (
        /* Non-admin view */
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
