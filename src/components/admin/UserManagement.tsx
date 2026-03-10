import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, UserPlus, Mail, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useJobSite } from '../../contexts/JobSiteContext';
import { useRealtimeSubscriptions } from '../../lib/hooks/useRealtime';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { UserForm } from './UserForm';
import { fetchUsers, inviteUser, resendInvite, updateUserBaseRole, assignUserToJobSite, removeJobSiteAssignment, importExistingAuthUsers } from '../../lib/api/users';
import { fetchJobSites } from '../../lib/api/jobSites';
import { getBaseRoleDisplayName, getRoleColor } from '../../lib/roleHelpers';
import type { UserProfile, JobSite } from '../../types';
import type { JobSiteAssignmentData } from './UserRoleManager';
import { toast } from 'sonner';

export function UserManagement() {
  const { user } = useAuth();
  const { availableJobSites } = useJobSite();
  const isManager = user?.base_role === 'manager';
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'email' | 'base_role' | 'sites' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (user?.org_id) {
      loadData();
    }
  }, [user?.org_id]);

  // Enable real-time subscriptions for user_profiles and job_site_assignments
  useRealtimeSubscriptions([
    { table: 'user_profiles', onUpdate: useCallback(() => loadUsers(), []) },
    { table: 'job_site_assignments', onUpdate: useCallback(() => loadUsers(), []) },
  ]);

  const loadData = async () => {
    await Promise.all([loadUsers(), loadJobSites()]);
  };

  const loadUsers = async () => {
    if (!user?.org_id) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchUsers(user.org_id);

      // Admins are scoped to users who share at least one active job site with them
      if (user.base_role === 'admin') {
        const adminSiteIds = new Set(
          user.job_site_assignments?.filter((a: any) => a.is_active).map((a: any) => a.job_site_id) || []
        );
        const scopedData = data.filter(
          (u) =>
            u.id === user.id ||
            u.job_site_assignments?.some((a: any) => a.is_active && adminSiteIds.has(a.job_site_id))
        );
        setUsers(scopedData);
      } else {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadJobSites = async () => {
    if (!user?.org_id) return;

    try {
      // Admins only see job sites they're assigned to; managers see all
      if (user.base_role === 'admin') {
        setJobSites(availableJobSites);
      } else {
        const data = await fetchJobSites(user.org_id);
        setJobSites(data);
      }
    } catch (error) {
      console.error('Error fetching job sites:', error);
    }
  };

  const handleSaveUser = async (userData: {
    email: string;
    name: string;
    phone?: string;
    base_role: string;
    job_site_assignments: JobSiteAssignmentData[];
  }) => {
    if (!user?.org_id) return;

    try {
      if (editingUser) {
        // Update existing user
        await updateUserBaseRole(editingUser.id, userData.base_role as any);

        // Handle job site assignments
        const existingAssignments = editingUser.job_site_assignments || [];
        const newAssignments = userData.job_site_assignments;

        // Remove assignments that are no longer in the list
        for (const existing of existingAssignments) {
          if (!newAssignments.some((a: any) => a.id === existing.id)) {
            if (existing.id) {
              await removeJobSiteAssignment(existing.id);
            }
          }
        }

        // Add new assignments
        for (const assignment of newAssignments) {
          if (!assignment.id) {
            await assignUserToJobSite({
              user_id: editingUser.id,
              job_site_id: assignment.job_site_id,
              role: assignment.role,
              start_date: assignment.start_date,
              assigned_by: user.id,
            });
          }
        }

        toast.success('User updated successfully');
      } else {
        // Invite new user — email is sent automatically
        await inviteUser({
          email: userData.email,
          name: userData.name,
          phone: userData.phone,
          base_role: userData.base_role as any,
          organization_id: user.org_id,
          job_site_assignments: userData.job_site_assignments.map((a: any) => ({
            job_site_id: a.job_site_id,
            role: a.role,
            start_date: a.start_date,
          })),
        });

        toast.success(`Invitation sent to ${userData.email}`);
      }

      loadUsers();
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Failed to save user');
    }
  };

  const handleEdit = (userProfile: UserProfile) => {
    setEditingUser(userProfile);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleResendInvite = async (email: string) => {
    setResendingInvite(email);
    try {
      await resendInvite(email);
      toast.success(`Invite resent to ${email}`);
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast.error(error.message || 'Failed to resend invite');
    } finally {
      setResendingInvite(null);
    }
  };

  const handleImportAuthUsers = async () => {
    if (!user?.org_id) return;

    setImporting(true);
    try {
      const result = await importExistingAuthUsers(user.org_id);

      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} user${result.imported > 1 ? 's' : ''}`);
        loadUsers();
      } else {
        toast.info('No new users to import. All auth users already have profiles.');
      }
    } catch (error: any) {
      console.error('Error importing auth users:', error);
      toast.error(error.message || 'Failed to import users. Make sure the SQL function is installed.');
    } finally {
      setImporting(false);
    }
  };

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ col }: { col: typeof sortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown size={14} className="text-text-secondary opacity-50" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={14} className="text-primary" />
      : <ArrowDown size={14} className="text-primary" />;
  };

  const filteredUsers = users
    .filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.base_role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortColumn === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortColumn === 'email') return a.email.localeCompare(b.email) * dir;
      if (sortColumn === 'base_role') return (a.base_role || '').localeCompare(b.base_role || '') * dir;
      if (sortColumn === 'sites') {
        const aCount = a.job_site_assignments?.filter((x: any) => x.is_active).length ?? 0;
        const bCount = b.job_site_assignments?.filter((x: any) => x.is_active).length ?? 0;
        return (aCount - bCount) * dir;
      }
      return 0;
    });

  if (loading) {
    return <div className="text-center py-12">Loading users...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Roles</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
          <option value="superintendent">Superintendent</option>
          <option value="engineer">Engineer</option>
          <option value="foreman">Foreman</option>
          <option value="worker">Worker</option>
        </select>

        <Button
          onClick={handleImportAuthUsers}
          variant="secondary"
          className="flex items-center gap-2"
          disabled={importing}
        >
          <UserPlus size={20} />
          {importing ? 'Importing...' : 'Import Existing'}
        </Button>

        {isManager && (
          <Button onClick={handleAddNew} className="flex items-center gap-2">
            <Plus size={20} />
            Invite User
          </Button>
        )}
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          {searchQuery || roleFilter !== 'all'
            ? 'No users match your search criteria'
            : 'No users yet. Click "Invite User" to add team members.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                {(['name', 'email', 'base_role', 'sites'] as const).map((col) => (
                  <th
                    key={col}
                    className="text-left py-3 px-4 text-sm font-medium text-text-secondary cursor-pointer select-none hover:text-text-primary"
                    onClick={() => handleSort(col)}
                  >
                    <span className="flex items-center gap-1">
                      {col === 'name' ? 'Name' : col === 'email' ? 'Email' : col === 'base_role' ? 'Base Role' : 'Assigned Sites'}
                      <SortIcon col={col} />
                    </span>
                  </th>
                ))}
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((userProfile) => {
                const activeAssignments = userProfile.job_site_assignments?.filter((a: any) => a.is_active) || [];
                return (
                  <tr key={userProfile.id} className="border-b border-border-primary hover:bg-bg-hover transition-colors">
                    <td className="py-3 px-4 text-text-primary font-medium">{userProfile.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{userProfile.email}</td>
                    <td className="py-3 px-4">
                      <Badge className={getRoleColor(userProfile.base_role || 'worker')}>
                        {getBaseRoleDisplayName(userProfile.base_role || 'worker')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {activeAssignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {activeAssignments.slice(0, 2).map((assignment: any) => (
                            <Badge key={assignment.id} variant="default" className="text-xs">
                              {assignment.job_site?.name || 'Unknown'}
                            </Badge>
                          ))}
                          {activeAssignments.length > 2 && (
                            <Badge variant="default" className="text-xs">
                              +{activeAssignments.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-secondary text-sm">No sites</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(userProfile)}
                          className="flex items-center gap-1"
                        >
                          <Edit2 size={14} />
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleResendInvite(userProfile.email)}
                          disabled={resendingInvite === userProfile.email}
                          className="flex items-center gap-1"
                          title="Resend invite email"
                        >
                          <Mail size={14} />
                          {resendingInvite === userProfile.email ? 'Sending...' : 'Resend Invite'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit User' : 'Invite New User'}
        size="lg"
      >
        <UserForm
          user={editingUser}
          availableJobSites={jobSites}
          onSave={handleSaveUser}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
}
