// ============================================================================
// Page Visibility Hook
// Detects when the page is visible/hidden to optimize data fetching
// ============================================================================

import { useEffect, useState } from 'react';

/**
 * Hook to track page visibility state using the Page Visibility API
 * Returns true when the page is visible, false when hidden (tab switched, minimized, etc)
 *
 * Use this to:
 * - Pause/resume data fetching when user switches tabs
 * - Reduce unnecessary API calls when app is in background
 * - Improve performance and reduce server load
 *
 * @example
 * const isVisible = usePageVisibility();
 *
 * useEffect(() => {
 *   if (isVisible) {
 *     // Resume data fetching
 *   } else {
 *     // Pause data fetching
 *   }
 * }, [isVisible]);
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);

      // Log visibility changes for debugging
      if (window.__APP_DIAGNOSTICS__) {
        const elapsed = Date.now() - window.__APP_DIAGNOSTICS__.startTime;
        window.__APP_DIAGNOSTICS__.checkpoints.push({
          name: `Page ${document.hidden ? 'hidden' : 'visible'}`,
          elapsed,
        });
        console.log(`[DIAGNOSTIC] Page ${document.hidden ? 'hidden' : 'visible'} (${elapsed}ms)`);
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Hook to execute a callback when page visibility changes
 *
 * @param onVisible - Callback when page becomes visible
 * @param onHidden - Callback when page becomes hidden
 *
 * @example
 * usePageVisibilityEffect(
 *   () => console.log('Page visible - resume fetching'),
 *   () => console.log('Page hidden - pause fetching')
 * );
 */
export function usePageVisibilityEffect(
  onVisible?: () => void,
  onHidden?: () => void
): void {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onHidden?.();
      } else {
        onVisible?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onVisible, onHidden]);
}
