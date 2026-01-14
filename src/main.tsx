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
