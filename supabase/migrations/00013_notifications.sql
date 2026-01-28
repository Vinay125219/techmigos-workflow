-- Migration: Create notifications table
-- User notifications for various events

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications" 
  ON public.notifications FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" 
  ON public.notifications FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications" 
  ON public.notifications FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" 
  ON public.notifications FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid());
