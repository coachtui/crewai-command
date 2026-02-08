import { useState, useEffect } from 'react';
import { Button } from './Button';

interface UpdateNotificationProps {
  registration: ServiceWorkerRegistration | null;
}

export function UpdateNotification({ registration }: UpdateNotificationProps) {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!registration) return;

    // Listen for new waiting SW
    const onUpdateFound = () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker installed and waiting
          setWaitingWorker(newWorker);
          setShowUpdate(true);
        }
      });
    };

    registration.addEventListener('updatefound', onUpdateFound);

    // Check if there's already a waiting SW (only once on mount)
    setTimeout(() => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }
    }, 100);

    // Check for updates every 60 seconds
    const intervalId = setInterval(() => {
      registration.update().catch((err) => {
        console.log('[SW] Update check failed:', err);
      });
    }, 60000);

    return () => {
      registration.removeEventListener('updatefound', onUpdateFound);
      clearInterval(intervalId);
    };
  }, [registration]);

  const handleUpdate = () => {
    if (!waitingWorker) return;

    // Send message to waiting SW to skip waiting
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // Listen for controlling SW change
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <div className="bg-bg-secondary rounded-lg shadow-md-soft border border-border p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-md bg-primary-subtle flex items-center justify-center">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">
              Update Available
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
              A new version of the app is ready. Click to update.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleUpdate} size="sm">
                Update Now
              </Button>
              <Button
                onClick={() => setShowUpdate(false)}
                variant="secondary"
                size="sm"
              >
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={() => setShowUpdate(false)}
            className="flex-shrink-0 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md p-1 transition-all duration-150"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
