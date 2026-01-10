import { useEffect } from 'react';
import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to subscribe to real-time changes on a Supabase table
 * Automatically refreshes data when changes occur
 */
export function useRealtimeSubscription(
  table: string,
  onUpdate: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    // Subscribe to all changes on the specified table
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`[Real-time] ${table} change detected:`, payload.eventType);
          // Trigger the callback to refresh data
          onUpdate();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Real-time] Subscribed to ${table} changes`);
        }
      });

    // Cleanup: unsubscribe when component unmounts
    return () => {
      console.log(`[Real-time] Unsubscribing from ${table} changes`);
      supabase.removeChannel(channel);
    };
  }, [table, onUpdate, enabled]);
}

/**
 * Hook to subscribe to multiple tables at once
 */
export function useRealtimeSubscriptions(
  subscriptions: Array<{ table: string; onUpdate: () => void }>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const channels: RealtimeChannel[] = [];

    // Create a subscription for each table
    subscriptions.forEach(({ table, onUpdate }) => {
      const channel = supabase
        .channel(`${table}-multi-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          (payload) => {
            console.log(`[Real-time] ${table} change:`, payload.eventType);
            onUpdate();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Real-time] Subscribed to ${table}`);
          }
        });

      channels.push(channel);
    });

    // Cleanup all channels
    return () => {
      console.log('[Real-time] Unsubscribing from all tables');
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [subscriptions, enabled]);
}
