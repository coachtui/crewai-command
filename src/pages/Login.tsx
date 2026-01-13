import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Fetch user role from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw userError;

      // Redirect based on role
      if (userData.role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/today');
      }

      toast.success('Login successful!');
    } catch (error) {
      toast.error((error as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
