-- Remove the foreign key constraint from profiles table to allow custom auth
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;