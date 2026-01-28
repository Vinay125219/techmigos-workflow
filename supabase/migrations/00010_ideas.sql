-- Migration: Create ideas table
-- Feature ideas and suggestions

CREATE TABLE IF NOT EXISTS public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under-review', 'approved', 'rejected', 'implemented')),
  votes INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ideas viewable by everyone" 
  ON public.ideas FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create ideas" 
  ON public.ideas FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Idea creators and admins can update" 
  ON public.ideas FOR UPDATE 
  TO authenticated 
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete ideas" 
  ON public.ideas FOR DELETE 
  TO authenticated 
  USING (public.is_admin(auth.uid()));
