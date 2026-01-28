-- Add explicit foreign key from activity_logs to profiles to enable PostgREST embedding
-- This allows access to profile data (name, avatar) when querying activity logs

DO $$ 
BEGIN
  -- Check if the constraint already exists before adding
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_user_id_profiles_fkey') THEN
    ALTER TABLE public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;
