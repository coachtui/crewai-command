import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { UpdateNotification } from './components/ui/UpdateNotification';

// Check for demo mode
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Register Service Worker for PWA (unless in demo mode)
    if ('serviceWorker' in navigator && !isDemoMode) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', {
            // Check for updates on page load - critical for preventing cache issues
            updateViaCache: 'none',
          })
          .then((reg) => {
            console.log('[SW] Registered:', reg);
            setRegistration(reg);

            // Handle updates - force reload when new version is available
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              console.log('[SW] Update found, installing new version');
              
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker installed while old one is controlling the page
                    console.log('[SW] New version available, prompting reload');
                    
                    // Send message to new worker to skip waiting
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                  }
                });
              }
            });

            // Listen for controller change (new SW activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              console.log('[SW] Controller changed, reloading page');
              // Force reload to get fresh content with new service worker
              window.location.reload();
            });

            // Check for updates immediately
            reg.update().catch((err) => {
              console.log('[SW] Initial update check failed:', err);
            });

            // Check for updates every 60 seconds when tab is visible
            setInterval(() => {
              if (document.visibilityState === 'visible') {
                reg.update().catch(() => {
                  // Silently fail - update check not critical
                });
              }
            }, 60000);
          })
          .catch((error) => {
            console.log('[SW] Registration failed:', error);
          });
      });
    } else if (isDemoMode) {
      console.log('[SW] Demo mode enabled - Service Worker disabled');
    }
  }, []);

  return (
    <StrictMode>
      <App />
      {!isDemoMode && <UpdateNotification registration={registration} />}
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
