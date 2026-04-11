import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Diagnostic logging
declare global {
  interface Window {
    __APP_DIAGNOSTICS__?: {
      startTime: number;
      checkpoints: Array<{ name: string; elapsed: number }>;
      errors: Array<{ source: string; error: string; elapsed: number }>;
    };
  }
}

function logCheckpoint(name: string) {
  if (window.__APP_DIAGNOSTICS__) {
    const elapsed = Date.now() - window.__APP_DIAGNOSTICS__.startTime;
    window.__APP_DIAGNOSTICS__.checkpoints.push({ name, elapsed });
    console.log(`[DIAGNOSTIC] ${name} (${elapsed}ms)`);
  }
}

logCheckpoint('main.tsx loaded');

// ── Service Worker Cleanup ────────────────────────────────────────────────────
// A sw.js was previously deployed and registered via the Web Push / PWA
// infrastructure. The file no longer exists in the project but browsers that
// loaded it still have it active as the SW controller. An active SW intercepts
// ALL fetch requests — including Supabase auth API calls — and can cause
// signInWithPassword to hang indefinitely if the SW has no cached response
// and no pass-through logic for that URL.
//
// This block unregisters every registered SW and, if one was actively
// controlling the page, reloads once so the fresh page load runs without a
// SW controller. The sessionStorage guard prevents an infinite reload loop.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length === 0) return;

    console.warn(`[SW] Unregistering ${registrations.length} stale service worker(s)`);
    Promise.all(registrations.map((r) => r.unregister())).then(() => {
      if (navigator.serviceWorker.controller && !sessionStorage.getItem('sw_cleared')) {
        // SW was controlling this page — reload once for a clean start.
        sessionStorage.setItem('sw_cleared', '1');
        console.warn('[SW] Reloading to clear SW control of this page');
        window.location.reload();
      } else {
        console.log('[SW] Stale service worker(s) unregistered — no reload needed');
      }
    });
  }).catch((err) => {
    console.warn('[SW] getRegistrations failed:', err);
  });
}

try {
  logCheckpoint('Importing App component');
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element not found');
  }

  logCheckpoint('Creating React root');
  const root = createRoot(rootElement);

  logCheckpoint('Rendering App');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  logCheckpoint('React render called');
} catch (error) {
  console.error('[DIAGNOSTIC ERROR] main.tsx:', error);
  if (window.__APP_DIAGNOSTICS__) {
    const elapsed = Date.now() - window.__APP_DIAGNOSTICS__.startTime;
    window.__APP_DIAGNOSTICS__.errors.push({
      source: 'main.tsx',
      error: String(error),
      elapsed
    });
  }

  // Show error UI
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 2rem; font-family: system-ui; background: #f3f4f6;">
        <div style="max-width: 600px; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #dc2626; margin-bottom: 1rem;">Application Failed to Load</h1>
          <p style="color: #374151; margin-bottom: 1rem;">An error occurred during app initialization:</p>
          <pre style="background: #fee; padding: 1rem; border-radius: 4px; overflow-x: auto; color: #991b1b;">${String(error)}</pre>
          <p style="color: #6b7280; margin-top: 1rem; font-size: 0.875rem;">Check the browser console for more details.</p>
        </div>
      </div>
    `;
  }
}
