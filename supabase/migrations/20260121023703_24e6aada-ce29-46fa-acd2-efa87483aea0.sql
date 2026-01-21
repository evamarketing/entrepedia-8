-- Create function to refresh/extend a session's expiry time
CREATE OR REPLACE FUNCTION public.refresh_session(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_exists boolean;
BEGIN
  -- Update the session expiry to 30 days from now if it's valid
  UPDATE public.user_sessions
  SET expires_at = now() + interval '30 days',
      updated_at = now()
  WHERE session_token = p_session_token
    AND is_active = true
    AND expires_at > now()
  RETURNING true INTO v_session_exists;
  
  RETURN COALESCE(v_session_exists, false);
END;
$$;

-- Add updated_at column to user_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_sessions' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.user_sessions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;