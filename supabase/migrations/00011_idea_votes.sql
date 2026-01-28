-- Migration: Create idea_votes table
-- Tracks user votes on ideas

CREATE TABLE IF NOT EXISTS public.idea_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(idea_id, user_id)
);

-- Enable RLS
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Votes viewable by everyone" 
  ON public.idea_votes FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can vote" 
  ON public.idea_votes FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change own vote" 
  ON public.idea_votes FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can remove own vote" 
  ON public.idea_votes FOR DELETE 
  TO authenticated 
  USING (user_id = auth.uid());
