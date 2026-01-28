-- Migration: Create tasks table
-- Task items that can belong to projects and workspaces

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  deliverables TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'review', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  estimated_hours INTEGER,
  deadline DATE,
  skills TEXT[] DEFAULT '{}',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tasks viewable by workspace members or public" 
  ON public.tasks FOR SELECT
  USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    OR public.is_workspace_owner(auth.uid(), workspace_id)
  );

CREATE POLICY "Authenticated users can create tasks" 
  ON public.tasks FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = created_by);

-- Allow task creators, assignees, admins, or anyone to take open unassigned tasks
CREATE POLICY "Task owners, assignees, and takers can update" 
  ON public.tasks FOR UPDATE 
  TO authenticated 
  USING (
    created_by = auth.uid() 
    OR assigned_to = auth.uid() 
    OR public.is_admin(auth.uid())
    OR (status = 'open' AND assigned_to IS NULL)
  );

CREATE POLICY "Task creators and admins can delete" 
  ON public.tasks FOR DELETE 
  TO authenticated 
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
