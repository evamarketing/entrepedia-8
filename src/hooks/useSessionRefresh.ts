import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'samrambhak_auth';
const REFRESH_INTERVAL = 1000 * 60 * 30; // Refresh every 30 minutes (more frequent)
const MIN_ACTIVITY_INTERVAL = 1000 * 60 * 2; // Minimum 2 minutes between refreshes
const SESSION_CHECK_INTERVAL = 1000 * 60 * 5; // Check session validity every 5 minutes

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

function getStoredAuth(): { user: any; session_token: string } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    return null;
  }
  return null;
}

export function useSessionRefresh(
  isAuthenticated: boolean,
  onSessionExpired?: () => void,
  onSessionRestored?: (user: any) => void
) {
  const lastRefreshRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Validate session and attempt auto-restore
  const validateAndRestoreSession = useCallback(async () => {
    const storedAuth = getStoredAuth();
    if (!storedAuth?.session_token) return;

    try {
      const { data: validatedUserId, error } = await supabase.rpc('validate_session', {
        p_session_token: storedAuth.session_token,
      });

      if (error || !validatedUserId) {
        console.warn('Session expired, attempting to refresh...');
        
        // Try to refresh the session first
        const refreshed = await refreshSession();
        
        if (!refreshed) {
          console.warn('Session refresh failed, clearing session');
          localStorage.removeItem(STORAGE_KEY);
          onSessionExpired?.();
        }
      } else {
        // Session is valid, restore if needed
        if (!isAuthenticated && onSessionRestored) {
          onSessionRestored({ ...storedAuth.user, id: String(validatedUserId) });
        }
      }
    } catch (err) {
      console.error('Session validation failed:', err);
    }
  }, [isAuthenticated, refreshSession, onSessionExpired, onSessionRestored]);

  // Periodic refresh
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Initial refresh on mount
    refreshSession();

    // Set up periodic refresh
    intervalRef.current = setInterval(refreshSession, REFRESH_INTERVAL);
    
    // Set up session validity check
    checkIntervalRef.current = setInterval(validateAndRestoreSession, SESSION_CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, refreshSession, validateAndRestoreSession]);

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

  // Handle visibility change - refresh when tab becomes visible
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User came back to the tab, validate and refresh session
        validateAndRestoreSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, validateAndRestoreSession]);

  // Handle online/offline status
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleOnline = () => {
      // When coming back online, validate session
      validateAndRestoreSession();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthenticated, validateAndRestoreSession]);

  return { refreshSession, validateAndRestoreSession };
}
