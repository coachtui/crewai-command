import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Check for invite/recovery tokens and redirect if already authenticated
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if this is an invite or recovery link (tokens in URL hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');

        if (type === 'invite' || type === 'recovery') {
          // Redirect to set-password page with the hash intact
          console.log('[Login] Invite/recovery link detected, redirecting to set-password');
          navigate('/set-password' + window.location.hash, { replace: true });
          return;
        }

        // Add 5-second timeout for login page session check
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Login session check timeout')), 5000)
        );

        const sessionPromise = supabase.auth.getSession();

        let result;
        try {
          result = await Promise.race([sessionPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.warn('[Login] Session check timed out, clearing session');
          localStorage.clear();
          setCheckingAuth(false);
          return;
        }

        const { data: { session } } = result as any;
        if (session) {
          console.log('[Login] Already authenticated, redirecting...');
          navigate('/workers', { replace: true });
        }
      } catch (error) {
        console.error('[Login] Session check error:', error);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkSession();
  }, [navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('[Login] Attempting login...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('[Login] Auth error:', authError);
        throw authError;
      }

      console.log('[Login] Auth successful, fetching user role...');

      // Try to fetch user role from users table (with timeout)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User data fetch timeout')), 5000)
      );

      const userDataPromise = supabase
        .from('users')
        .select('role, base_role')
        .eq('id', authData.user.id)
        .single();

      try {
        const result = await Promise.race([userDataPromise, timeoutPromise]);
        const userData = (result as { data: { role?: string; base_role?: string } | null }).data;

        console.log('[Login] User data fetched:', userData);

        // Redirect based on role (with fallback to /workers)
        if (userData?.role === 'admin' || userData?.base_role === 'admin') {
          console.log('[Login] Redirecting admin to /workers');
          navigate('/workers', { replace: true });
        } else {
          console.log('[Login] Redirecting user to /workers');
          navigate('/workers', { replace: true });
        }
      } catch (userError) {
        // If user data fetch fails, still redirect to default page
        console.warn('[Login] User data fetch failed, redirecting to default:', userError);
        navigate('/workers', { replace: true });
      }

      toast.success('Login successful!');
    } catch (error) {
      console.error('[Login] Login failed:', error);
      toast.error((error as Error).message || 'Login failed');
      setLoading(false);
    }
    // Don't setLoading(false) on success - let the redirect happen
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary">Checking authentication...</span>
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
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                type="password"
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-text-secondary mt-4">
            Demo: admin@demo.com / foreman@demo.com
          </p>
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
