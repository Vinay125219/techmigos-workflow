-- Migration: Create projects table
-- Project containers for organizing tasks

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'on-hold')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  start_date DATE,
  end_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Projects viewable by workspace members or public" 
  ON public.projects FOR SELECT
  USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    OR public.is_workspace_owner(auth.uid(), workspace_id)
  );

CREATE POLICY "Authenticated users can create projects" 
  ON public.projects FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project creators and admins can update" 
  ON public.projects FOR UPDATE 
  TO authenticated 
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Project creators and admins can delete" 
  ON public.projects FOR DELETE 
  TO authenticated 
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
