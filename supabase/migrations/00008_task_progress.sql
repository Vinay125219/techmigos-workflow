-- Migration: Create task_progress table
-- Tracks progress updates on tasks

CREATE TABLE IF NOT EXISTS public.task_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hours_worked NUMERIC(5,2) DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Progress viewable by everyone" 
  ON public.task_progress FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can add progress" 
  ON public.task_progress FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" 
  ON public.task_progress FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own progress" 
  ON public.task_progress FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
