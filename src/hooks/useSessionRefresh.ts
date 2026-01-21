import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'samrambhak_auth';
const REFRESH_INTERVAL = 1000 * 60 * 60; // Refresh every hour
const MIN_ACTIVITY_INTERVAL = 1000 * 60 * 5; // Minimum 5 minutes between refreshes

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { session_token } = JSON.parse(stored);
      return session_token || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function useSessionRefresh(isAuthenticated: boolean) {
  const lastRefreshRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshSession = useCallback(async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return false;

    const now = Date.now();
    // Prevent too frequent refreshes
    if (now - lastRefreshRef.current < MIN_ACTIVITY_INTERVAL) {
      return true;
    }

    try {
      const { data, error } = await supabase.rpc('refresh_session', {
        p_session_token: sessionToken,
      });

      if (error) {
        console.error('Session refresh error:', error);
        return false;
      }

      if (data) {
        lastRefreshRef.current = now;
        console.log('Session refreshed successfully');
        return true;
      }

      return false;
    } catch (err) {
      console.error('Session refresh failed:', err);
      return false;
    }
  }, []);

  // Periodic refresh
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial refresh on mount
    refreshSession();

    // Set up periodic refresh
    intervalRef.current = setInterval(refreshSession, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, refreshSession]);

  // Refresh on user activity (throttled)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current >= MIN_ACTIVITY_INTERVAL) {
        refreshSession();
      }
    };

    // Listen for user activity events
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, refreshSession]);

  return { refreshSession };
}
