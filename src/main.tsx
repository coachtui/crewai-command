import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  useEffect(() => {
    // SERVICE WORKER DISABLED - Causing caching conflicts
    // Unregister any existing service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
          console.log('[SW] Unregistered existing service worker');
        });
      });
    }
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
          console.log('[SW] Cache deleted:', name);
        });
      });
    }
    
    console.log('[SW] Service Worker disabled - running without PWA caching');
  }, []);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
