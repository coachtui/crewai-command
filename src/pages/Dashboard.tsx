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
        <h1 className="text-3xl font-bold text-text-primary mb-2">Dashboard</h1>
        <p className="text-text-secondary">Welcome back, {user?.name}!</p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <CheckSquare className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-text-secondary text-sm">Active Tasks</p>
              <p className="text-2xl font-bold text-text-primary">--</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center">
              <Users className="text-success" size={24} />
            </div>
            <div>
              <p className="text-text-secondary text-sm">Workers on Site</p>
              <p className="text-2xl font-bold text-text-primary">--</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-warning/20 flex items-center justify-center">
              <AlertCircle className="text-warning" size={24} />
            </div>
            <div>
              <p className="text-text-secondary text-sm">Pending Requests</p>
              <p className="text-2xl font-bold text-text-primary">--</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Admin Management Section */}
      {isAdmin ? (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-text-primary mb-2">Organization Management</h2>
            <p className="text-text-secondary">Manage job sites, workers, and user access across your organization</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border-primary overflow-x-auto">
            <button
              onClick={() => setActiveTab('job-sites')}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'job-sites'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Job Sites
            </button>
            <button
              onClick={() => setActiveTab('workers')}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'workers'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Workers
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'users'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
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
        <div className="text-center py-12 bg-bg-secondary rounded-lg border border-border-primary">
          <p className="text-text-secondary mb-2">More features coming soon!</p>
          <p className="text-sm text-text-secondary">
            The dashboard will display personalized insights and quick actions based on your role.
          </p>
        </div>
      )}
    </div>
  );
}
