-- Drop the existing restrictive policy that blocks all access
DROP POLICY IF EXISTS "Service role only for sessions" ON user_sessions;

-- Disable RLS for user_sessions table (service role handles it via edge functions)
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;