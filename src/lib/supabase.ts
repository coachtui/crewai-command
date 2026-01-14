import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Environment Variable Validation with User-Friendly Error UI
// ============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Track if environment is properly configured
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Log environment status for debugging
if (typeof window !== 'undefined' && window.__APP_DIAGNOSTICS__) {
  const elapsed = Date.now() - window.__APP_DIAGNOSTICS__.startTime;
  window.__APP_DIAGNOSTICS__.checkpoints.push({
    name: `Supabase config check (configured: ${isConfigured})`,
    elapsed
  });
  console.log(`[DIAGNOSTIC] Supabase config check (${elapsed}ms) - configured: ${isConfigured}`);
}

if (!isConfigured) {
  console.error('[ENV ERROR] Missing required environment variables:');
  console.error('  - VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.error('  - VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing');

  // Show user-friendly error UI instead of crashing
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root && !root.innerHTML.trim()) {
        root.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui; background: #f3f4f6;">
            <div style="max-width: 600px; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h1 style="color: #dc2626; margin-bottom: 1rem;">⚠️ Configuration Error</h1>
              <p style="color: #374151; margin-bottom: 1rem;">The application is missing required environment variables:</p>
              <ul style="color: #374151; margin-bottom: 1rem; padding-left: 1.5rem;">
                ${!supabaseUrl ? '<li><code>VITE_SUPABASE_URL</code> is not set</li>' : ''}
                ${!supabaseAnonKey ? '<li><code>VITE_SUPABASE_ANON_KEY</code> is not set</li>' : ''}
              </ul>
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; margin-bottom: 1rem;">
                <p style="color: #92400e; margin: 0; font-size: 0.875rem;">
                  <strong>For Vercel deployments:</strong> Add these variables in your Vercel project settings under "Environment Variables".
                </p>
              </div>
              <details style="margin-top: 1rem; cursor: pointer;">
                <summary style="color: #6b7280; font-size: 0.875rem;">Show diagnostic info</summary>
                <pre style="background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem; font-size: 0.75rem;">${JSON.stringify(window.__APP_DIAGNOSTICS__, null, 2)}</pre>
              </details>
            </div>
          </div>
        `;
      }
    }, 100);
  }

  // Create a dummy client that will fail gracefully
  // This prevents module evaluation from throwing
  throw new Error('Missing Supabase environment variables - check Vercel environment settings');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
