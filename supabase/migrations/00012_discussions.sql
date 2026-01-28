-- Migration: Create discussions table
-- Comments and discussions on projects, tasks, and ideas

CREATE TABLE IF NOT EXISTS public.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.discussions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'task', 'idea')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Discussions viewable by everyone" 
  ON public.discussions FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create discussions" 
  ON public.discussions FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discussions" 
  ON public.discussions FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users and admins can delete discussions" 
  ON public.discussions FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
