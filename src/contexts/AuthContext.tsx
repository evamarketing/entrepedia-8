import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionRefresh } from '@/hooks/useSessionRefresh';

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  role: 'user' | 'admin';
  is_online: boolean;
  is_verified: boolean | null;
  mobile_number: string | null;
  email: string | null;
  email_verified: boolean | null;
  email_verification_token: string | null;
  email_verification_sent_at: string | null;
  show_email?: boolean;
  show_mobile?: boolean;
  show_location?: boolean;
  created_at: string;
}

interface User {
  id: string;
  mobile_number: string;
  full_name: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isProfileComplete: boolean;
  signInWithMobile: (mobileNumber: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithMobile: (mobileNumber: string, password: string, fullName: string, username: string, dateOfBirth?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'samrambhak_auth';

// Separate component that handles session refresh - must be inside AuthProvider
function SessionRefreshManager({ onSessionExpired, onSessionRestored }: { 
  onSessionExpired: () => void;
  onSessionRestored: (user: User) => void;
}) {
  const { user } = useAuth();
  useSessionRefresh(!!user, onSessionExpired, onSessionRestored);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { user: storedUser, session_token } = JSON.parse(stored);
          if (storedUser && session_token) {
            // Validate session token against DB to avoid using stale localStorage sessions
            const { data: validatedUserId, error: validateError } = await supabase
              .rpc('validate_session', { p_session_token: session_token });

            if (validateError || !validatedUserId) {
              console.warn('Stored session token is invalid/expired. Clearing local session.');
              localStorage.removeItem(STORAGE_KEY);
            } else {
              // If DB returns a different user id, prefer the DB truth
              const userId = String(validatedUserId);
              setUser({ ...storedUser, id: userId });
              await fetchProfile(userId);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const signInWithMobile = async (mobileNumber: string, password: string) => {
    try {
      const response = await supabase.functions.invoke('mobile-auth', {
        body: {
          action: 'signin',
          mobile_number: mobileNumber,
          password,
        },
      });

      // Handle HTTP errors from edge function (4xx, 5xx responses)
      if (response.error) {
        // Try to extract error message from the error context
        const errorMessage = response.error.message || 'Sign in failed';
        // Check if context contains the actual error from JSON response
        const contextError = (response.error as any)?.context?.body;
        if (contextError) {
          try {
            const parsed = JSON.parse(contextError);
            if (parsed.error) {
              return { error: new Error(parsed.error) };
            }
          } catch {
            // Ignore parse errors
          }
        }
        return { error: new Error(errorMessage) };
      }

      const data = response.data;
      
      if (data?.error) {
        return { error: new Error(data.error) };
      }

      // Store session
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: data.user,
        session_token: data.session_token,
      }));

      setUser(data.user);
      await fetchProfile(data.user.id);

      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message || 'Sign in failed') };
    }
  };

  const signUpWithMobile = async (mobileNumber: string, password: string, fullName: string, username: string, dateOfBirth?: string) => {
    try {
      const response = await supabase.functions.invoke('mobile-auth', {
        body: {
          action: 'signup',
          mobile_number: mobileNumber,
          password,
          full_name: fullName,
          username,
          date_of_birth: dateOfBirth,
        },
      });

      if (response.error) {
        return { error: new Error(response.error.message || 'Sign up failed') };
      }

      const data = response.data;
      
      if (data.error) {
        return { error: new Error(data.error) };
      }

      // Store session
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: data.user,
        session_token: data.session_token,
      }));

      setUser(data.user);
      await fetchProfile(data.user.id);

      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message || 'Sign up failed') };
    }
  };

  const signOut = async () => {
    // Update online status before signing out
    if (user) {
      await supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }
    
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  // Check if profile is complete
  const isProfileComplete = !!(
    profile?.full_name &&
    profile?.username &&
    profile?.location
  );

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setProfile(null);
  }, []);

  // Handle session restoration
  const handleSessionRestored = useCallback(async (restoredUser: User) => {
    setUser(restoredUser);
    await fetchProfile(restoredUser.id);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isProfileComplete,
        signInWithMobile,
        signUpWithMobile,
        signOut,
        refreshProfile,
      }}
    >
      <SessionRefreshManager 
        onSessionExpired={handleSessionExpired} 
        onSessionRestored={handleSessionRestored} 
      />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
