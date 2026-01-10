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
            // Check for updates on page load
            updateViaCache: 'none',
          })
          .then((reg) => {
            console.log('[SW] Registered:', reg);
            setRegistration(reg);

            // Check for updates immediately
            reg.update().catch((err) => {
              console.log('[SW] Initial update check failed:', err);
            });
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
