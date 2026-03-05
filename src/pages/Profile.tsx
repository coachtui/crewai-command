import { useState } from 'react';
import { useAuth } from '../contexts';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { CircleUser } from 'lucide-react';

export function Profile() {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const profileChanged =
    name !== (user?.name || '') ||
    phone !== (user?.phone || '') ||
    email !== (user?.email || '');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updates: { name?: string; phone?: string; email?: string } = {};
      if (name !== user?.name) updates.name = name;
      if (phone !== (user?.phone || '')) updates.phone = phone;
      if (email !== user?.email) updates.email = email;

      await updateProfile(updates);

      if (updates.email) {
        toast.success('Profile updated. Check your new email address to confirm the change.');
      } else {
        toast.success('Profile updated.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-subtle border border-primary/20 flex items-center justify-center flex-shrink-0">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.name || ''} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <CircleUser size={28} className="text-primary" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{user?.name || 'Profile'}</h1>
          <p className="text-sm text-text-secondary capitalize">{user?.base_role || user?.role}</p>
        </div>
      </div>

      {/* Profile Info */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Profile Info</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="—"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
            {email !== user?.email && (
              <p className="text-xs text-text-secondary">A confirmation link will be sent to the new address.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!profileChanged || savingProfile}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* Change Password */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>
          <button
            type="submit"
            disabled={!newPassword || savingPassword}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingPassword ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  );
}
