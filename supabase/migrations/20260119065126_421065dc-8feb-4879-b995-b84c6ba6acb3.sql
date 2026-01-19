-- Add a dedicated mobile number column to profiles for phone-based auth
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- Prevent duplicate mobile numbers (case/whitespace safe)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_mobile_number_unique
ON public.profiles ((trim(mobile_number)))
WHERE mobile_number IS NOT NULL;

-- Optional helper index for lookups
CREATE INDEX IF NOT EXISTS profiles_mobile_number_idx
ON public.profiles (mobile_number);
