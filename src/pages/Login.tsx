import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { Eye, EyeOff, Smartphone, RefreshCw, Mic, MapPin } from 'lucide-react';

// ── Product Proof Panel (desktop) ───────────────────────────────────────────

function ProofPanel() {
  const bullets = [
    { icon: MapPin,      text: 'Multi-site job management' },
    { icon: Smartphone,  text: 'Mobile-first for field crews' },
    { icon: RefreshCw,   text: 'Real-time sync across devices' },
    { icon: Mic,         text: 'Voice input for fast logging' },
  ];

  return (
    <div className="hidden lg:flex flex-col justify-center bg-primary-subtle rounded-2xl p-10 h-full min-h-[460px]">
      {/* Mini app mock */}
      <div className="bg-white rounded-xl shadow-md-soft border border-border p-4 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[12px] font-medium text-text-secondary">Site A — Today's Crew</span>
        </div>
        <div className="space-y-2">
          {[
            { name: 'J. Martinez', role: 'Foreman' },
            { name: 'A. Lee',      role: 'Carpenter' },
            { name: 'M. Rivera',   role: 'Mason' },
          ].map(({ name, role }) => (
            <div
              key={name}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-bg-subtle"
            >
              <div>
                <span className="text-[13px] text-text-primary font-medium">{name}</span>
                <span className="text-[12px] text-text-secondary ml-2">{role}</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                8 h
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bullet list */}
      <ul className="space-y-3">
        {bullets.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-subtle shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[14px] text-text-primary font-medium">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Login Page ───────────────────────────────────────────────────────────────

export function Login() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [setupError, setSetupError]     = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();

  // Read and clear the ghost-state error flag set by AuthContext.
  // Shown when a Supabase session exists but no profile row was found.
  useEffect(() => {
    const flag = localStorage.getItem('crewai_auth_error');
    if (flag === 'no_profile') {
      setSetupError('Your account is not fully set up. Contact your administrator.');
      localStorage.removeItem('crewai_auth_error');
    }
  }, []);

  // Check for invite/recovery tokens in URL
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'invite' || type === 'recovery') {
      console.log('[Login] Invite/recovery link detected, redirecting to set-password');
      navigate('/set-password' + window.location.hash, { replace: true });
    }
  }, [navigate]);

  // Redirect as soon as auth state confirms authentication.
  // Deliberately does NOT wait for isLoading — the login form must render
  // immediately regardless of auth bootstrap state, so the page is never
  // inaccessible due to a hung or slow INITIAL_SESSION event.
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[Login] Already authenticated, redirecting...');
      navigate('/workers', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('[Login] Submit: starting sign-in');

      // Stall detector: logs at 18s if sign-in hasn't resolved.
      // Threshold accounts for worst-case: up to 8s SDK init wait + actual
      // sign-in network time (lock contention handled in AuthContext.signIn).
      const stallTimer = setTimeout(() => {
        console.error('[Login] sign-in stalled after 18s — network or DB issue');
      }, 18000);

      // Hard timeout at 25s: rejects so the button always unfreezes.
      await Promise.race<void>([
        signIn(email, password),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Sign-in timed out. Please refresh the page and try again.')),
            25000
          )
        ),
      ]).finally(() => clearTimeout(stallTimer));

      // signIn() explicitly fetches the profile and sets isAuthenticated=true
      // before resolving — the isAuthenticated effect above handles navigation.
      console.log('[Login] Submit: sign-in complete, isAuthenticated set');
      toast.success('Login successful!');
    } catch (error) {
      console.error('[Login] Submit: login failed:', (error as Error).message, error);
      toast.error((error as Error).message || 'Login failed');
    } finally {
      console.log('[Login] Submit: finally — resetting loading state');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 py-12">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-stretch">

        {/* ── Auth Card ── */}
        <div className="w-full lg:w-[420px] shrink-0 bg-bg-secondary rounded-2xl border border-border shadow-md-soft p-8 flex flex-col justify-center">

          {/* Brand row */}
          <div className="mb-7">
            <Link to="/" aria-label="CRU home">
              <img src="/image/cru-logo-tiff.png" alt="CRU" className="h-8 w-auto mb-5" />
            </Link>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">
              Sign in to CRU
            </h1>
            <p className="text-[14px] text-text-secondary mt-1">
              Manage crews, tasks, hours — multi-site.
            </p>
          </div>

          {/* Account setup error — shown when auth succeeds but profile row is missing */}
          {setupError && (
            <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px] text-warning leading-snug">
              {setupError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {/* Password with show/hide toggle */}
            <div className="w-full">
              <label className="block text-[13px] font-medium text-text-primary mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 pr-10 text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full !mt-6"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        {/* ── Proof Panel (desktop only) ── */}
        <div className="flex-1">
          <ProofPanel />
        </div>

      </div>
    </div>
  );
}
