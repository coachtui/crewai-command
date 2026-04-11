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

// ── Service Worker Cleanup ────────────────────────────────────────────────────
// A sw.js was previously deployed; browsers that loaded it still have it active
// as the page's fetch controller. An active SW intercepts ALL requests —
// including Supabase auth API calls — causing signInWithPassword to hang.
//
// navigator.serviceWorker.controller is synchronous. Checking it here, before
// React mounts, lets us handle two cases without a race condition:
//
//   CASE A — SW is actively controlling this page right now:
//     Replace the DOM with a loading state, unregister the SW, and reload.
//     React is NOT rendered — the user cannot submit the login form while
//     a SW is still intercepting fetches.
//
//   CASE B — No active SW controller (normal path after reload, or clean env):
//     Mount React normally. Silently clean up any orphaned (non-controlling)
//     SW registrations in the background.
//
// The sessionStorage guard prevents an infinite reload loop.

const swControlling =
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  !!navigator.serviceWorker.controller;

if (swControlling && !sessionStorage.getItem('sw_cleared')) {
  // CASE A — block React render, clear SW, reload once
  sessionStorage.setItem('sw_cleared', '1');
  console.warn('[SW] Active service worker detected — clearing before React mounts');

  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#9ca3af;font-size:14px;">Loading\u2026</div>';
  }

  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {})
    .finally(() => window.location.reload());

  // Intentionally no React render here — reload handles the next page load.
} else {
  // CASE B — no active SW; silently clean up orphaned registrations
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        if (regs.length > 0) {
          console.log(`[SW] Removing ${regs.length} orphaned SW registration(s)`);
          regs.forEach((r) => r.unregister());
        }
      })
      .catch(() => {});
  }

  logCheckpoint('main.tsx loaded');

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
        elapsed,
      });
    }

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
}
