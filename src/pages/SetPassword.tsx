import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';

export function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleInviteToken = async () => {
      try {
        // Check if there's a hash in the URL (invite/recovery tokens come via hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('[SetPassword] URL type:', type);

        if (accessToken && refreshToken && (type === 'invite' || type === 'recovery')) {
          // Set the session from the tokens in the URL
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('[SetPassword] Session error:', sessionError);
            setError('Invalid or expired invitation link. Please request a new one.');
            setCheckingSession(false);
            return;
          }

          if (data.user) {
            setUserEmail(data.user.email || null);
            // Clear the hash from URL for cleaner UX
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else {
          // No tokens in URL, check if user is already signed in
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            setUserEmail(session.user.email || null);
          } else {
            // No session and no tokens - redirect to login
            setError('No valid session found. Please use the link from your invitation email.');
          }
        }
      } catch (err) {
        console.error('[SetPassword] Error:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setCheckingSession(false);
      }
    };

    handleInviteToken();
  }, []);

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // Sign out first to ensure clean login state
      await supabase.auth.signOut();

      toast.success('Password set successfully! Please log in with your new password.');

      // Redirect to login page
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      console.error('[SetPassword] Update error:', err);
      toast.error((err as Error).message || 'Failed to set password');
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary">Verifying invitation...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-primary">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <img
                  src="/image/crewai-command-logo.png"
                  alt="CrewAI Command"
                  className="h-24 w-auto"
                />
              </div>
            </div>

            <div className="bg-bg-secondary border border-border rounded-lg p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Invalid Invitation
                </h2>
                <p className="text-text-secondary mb-6">{error}</p>
                <Button onClick={() => navigate('/login', { replace: true })}>
                  Go to Login
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src="/image/crewai-command-logo.png"
                alt="CrewAI Command"
                className="h-24 w-auto"
              />
            </div>
          </div>

          <div className="bg-bg-secondary border border-border rounded-lg p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Set Your Password
              </h2>
              {userEmail && (
                <p className="text-text-secondary text-sm">
                  Welcome! Please set a password for <strong>{userEmail}</strong>
                </p>
              )}
            </div>

            <form onSubmit={handleSetPassword} className="space-y-4">
              <Input
                type="password"
                label="New Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />

              <Input
                type="password"
                label="Confirm Password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Setting password...' : 'Set Password'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-bg-secondary border-t border-border py-6 mt-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-3">
            <img
              src="/image/aiga-logo.png"
              alt="AIGA"
              className="h-12 w-auto"
            />
          </div>
          <p className="text-sm font-medium text-text-primary mb-2">Powered by AIGA</p>
          <p className="text-xs text-text-secondary mb-1">&copy; 2025 AIGA LLC. All rights reserved.</p>
          <p className="text-xs text-text-secondary">AIGA® and related product names and logos are trademarks of AIGA LLC.</p>
        </div>
      </footer>
    </div>
  );
}
